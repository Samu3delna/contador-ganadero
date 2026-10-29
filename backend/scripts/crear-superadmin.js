#!/usr/bin/env node
/**
 * Script seguro de consola para promover o crear un Super Administrador de plataforma.
 * Uso:
 *   node scripts/crear-superadmin.js --email=admin@tudominio.com [--dry-run]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const { registrarEventoSeguridad } = require('../utils/audit');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const emailArg = args.find((a) => a.startsWith('--email='));
  const email = emailArg ? emailArg.split('=')[1]?.trim().toLowerCase() : null;

  if (!email) {
    console.error('Uso: node scripts/crear-superadmin.js --email=correo@dominio.com [--dry-run]');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('Falta MONGODB_URI en el entorno.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const usuario = await Usuario.findOne({ email });

  if (!usuario) {
    console.error(`No se encontró un usuario registrado con el correo: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[DRY-RUN] Se asignaría rol='superadmin' y esSuperAdmin=true al usuario ${usuario._id} (${usuario.email})`);
    await mongoose.disconnect();
    process.exit(0);
  }

  usuario.rol = 'superadmin';
  usuario.esSuperAdmin = true;
  await usuario.save();

  await registrarEventoSeguridad({
    action: 'SUPERADMIN_PROMOTED_CLI',
    actorId: usuario._id,
    tenantId: usuario.tenantId,
    targetId: String(usuario._id),
    metadata: { email: usuario.email },
  });

  console.log(`✅ Usuario ${usuario.email} promovido a superadmin exitosamente.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
