#!/usr/bin/env node
/**
 * Script de migración de secretos cifrados desde formato legacy AES-256-CBC (iv:cipher)
 * hacia formato autenticado AES-256-GCM con llave por tenant (v2:kid:iv:tag:cipher).
 *
 * Uso:
 *   node scripts/migrateCryptoGcm.js --dry-run
 *   node scripts/migrateCryptoGcm.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const { needsReencryption, reencryptSecret } = require('../utils/crypto');

const SECRET_FIELDS = [
  'haciendaConfig.certificadoP12Enc',
  'haciendaConfig.pinP12Enc',
  'haciendaConfig.haciendaUserEnc',
  'haciendaConfig.haciendaPassEnc',
  'imapConfig.passEnc',
];

function getNested(obj, pathStr) {
  return pathStr.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

function setNested(obj, pathStr, val) {
  const parts = pathStr.split('.');
  const last = parts.pop();
  const target = parts.reduce((acc, k) => {
    if (!acc[k]) acc[k] = {};
    return acc[k];
  }, obj);
  target[last] = val;
}

async function migrateTenants({ dryRun = true } = {}) {
  const tenants = await Tenant.find({});
  let migrados = 0;

  for (const tenant of tenants) {
    let modificado = false;
    const tenantIdStr = String(tenant._id);

    for (const fieldPath of SECRET_FIELDS) {
      const currentVal = getNested(tenant, fieldPath);
      if (currentVal && needsReencryption(currentVal)) {
        const nuevoVal = reencryptSecret(currentVal, {
          tenantId: tenantIdStr,
          fieldName: fieldPath,
        });
        setNested(tenant, fieldPath, nuevoVal);
        modificado = true;
      }
    }

    if (modificado) {
      migrados++;
      if (!dryRun) {
        await tenant.save();
      }
    }
  }

  return { totalRevisados: tenants.length, migrados, dryRun };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.MONGODB_URI) {
    console.error('Falta MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await migrateTenants({ dryRun });
  console.log(JSON.stringify(res, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error en migración GCM:', err.message);
    process.exit(1);
  });
}

module.exports = { migrateTenants };
