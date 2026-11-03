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
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Usuario = require('../models/Usuario');
const { needsReencryption, reencryptSecret, decryptSecret } = require('../utils/crypto');

const SECRET_FIELDS = [
  'configuracionHacienda.certificadoP12Base64',
  'configuracionHacienda.pinCertificado',
  'configuracionHacienda.passwordHacienda',
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
  const tenants = await Tenant.find({}).select(SECRET_FIELDS.map(p => `+${p}`).join(' '));
  let migrados = 0;
  const pendientesReconfiguracion = [];

  for (const tenant of tenants) {
    let modificado = false;
    const tenantIdStr = String(tenant._id);

    for (const fieldPath of SECRET_FIELDS) {
      const currentVal = getNested(tenant, fieldPath);
      if (currentVal) {
        const context = {
          tenantId: tenantIdStr,
          fieldName: fieldPath,
        };
        try {
          const plain = decryptSecret(currentVal, context);
          if (needsReencryption(currentVal)) {
            const nuevoVal = reencryptSecret(currentVal, context);
            if (decryptSecret(nuevoVal, context) !== plain) throw new Error('Roundtrip fallido');
            setNested(tenant, fieldPath, nuevoVal); modificado = true;
          }
        } catch { pendientesReconfiguracion.push({ id: tenantIdStr, campo: fieldPath }); }
      }
    }

    if (modificado) {
      migrados++;
      if (!dryRun) {
        await tenant.save();
      }
    }
  }

  const users = await Usuario.find({ 'configEmail.password': { $exists: true } }).select('+configEmail.password');
  let usuariosMigrados = 0;
  for (const user of users) {
    const current = user.configEmail?.password;
    if (!current) continue;
    const ctx = { tenantId: String(user.tenantId || user._id), fieldName: 'configEmail.password' };
    try {
      const plain = decryptSecret(current, ctx);
      if (needsReencryption(current)) {
        const next = reencryptSecret(current, ctx);
        if (decryptSecret(next, ctx) !== plain) throw new Error('Roundtrip fallido');
        if (!dryRun) await Usuario.updateOne({ _id: user._id, 'configEmail.password': current }, { $set: { 'configEmail.password': next } });
        usuariosMigrados++;
      }
    } catch { pendientesReconfiguracion.push({ id: String(user._id), campo: 'configEmail.password' }); }
  }
  return { totalRevisados: tenants.length, migrados, usuariosMigrados, pendientesReconfiguracion, dryRun };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.MONGODB_URI) {
    console.error('Falta MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });
  const res = await migrateTenants({ dryRun });
  console.log(JSON.stringify(res, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
  main().catch((err) => {
    console.error('Error en migración GCM:', err.message);
    process.exit(1);
  });
}

module.exports = { migrateTenants };
