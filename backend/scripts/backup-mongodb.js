#!/usr/bin/env node
/**
 * Script de respaldo cifrado (AES-256-GCM) con hash de integridad SHA-256.
 * Exporta las colecciones de MongoDB y las cifra con BACKUP_ENCRYPTION_KEY.
 *
 * Uso:
 *   node scripts/backup-mongodb.js [--output-dir=./backups] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');

function cifrarBufferGcm(buffer, hexKey) {
  if (!hexKey || !/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('BACKUP_ENCRYPTION_KEY debe ser una llave hexadecimal de 64 caracteres (32 bytes)');
  }
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('CGBK01'), iv, tag, encrypted]);
}

function descifrarBufferGcm(payload, hexKey) {
  if (!hexKey || !/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('BACKUP_ENCRYPTION_KEY inválida');
  }
  const header = payload.subarray(0, 6).toString('utf8');
  if (header !== 'CGBK01') {
    throw new Error('Formato de archivo de respaldo inválido');
  }
  const iv = payload.subarray(6, 18);
  const tag = payload.subarray(18, 34);
  const ciphertext = payload.subarray(34);
  const key = Buffer.from(hexKey, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function crearRespaldoCifrado({ outputDir, encryptionKey, dryRun = false } = {}) {
  const key = encryptionKey || process.env.BACKUP_ENCRYPTION_KEY || process.env.EMAIL_ENC_KEY;
  const colecciones = await mongoose.connection.db.listCollections().toArray();
  const dump = {
    version: 1,
    createdAt: new Date().toISOString(),
    collections: {},
  };

  for (const col of colecciones) {
    const docs = await mongoose.connection.db.collection(col.name).find({}).toArray();
    dump.collections[col.name] = docs;
  }

  const jsonBuffer = Buffer.from(JSON.stringify(dump), 'utf8');
  const compressed = zlib.gzipSync(jsonBuffer);
  const encrypted = cifrarBufferGcm(compressed, key);
  const sha256 = crypto.createHash('sha256').update(encrypted).digest('hex');

  if (dryRun) {
    return { dryRun: true, collections: Object.keys(dump.collections), bytes: encrypted.length, sha256 };
  }

  const dir = outputDir || path.resolve(__dirname, '..', 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(dir, `backup-${ts}.cgbk`);
  fs.writeFileSync(filePath, encrypted);
  fs.writeFileSync(`${filePath}.sha256`, `${sha256}  ${path.basename(filePath)}\n`, 'utf8');

  return { filePath, sha256, bytes: encrypted.length, collections: Object.keys(dump.collections) };
}

module.exports = {
  cifrarBufferGcm,
  descifrarBufferGcm,
  crearRespaldoCifrado,
};
