#!/usr/bin/env node
/**
 * Script de restauración verificada desde un respaldo cifrado (.cgbk).
 * Verifica el hash SHA-256 y el AuthTag de AES-256-GCM antes de descomprimir.
 * Requiere confirmación explícita (--confirm-restore) para escribir en la base de datos.
 */

const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { descifrarBufferGcm } = require('./backup-mongodb');

async function restaurarRespaldoCifrado({ filePath, expectedSha256, encryptionKey, dryRun = true } = {}) {
  const key = encryptionKey || process.env.BACKUP_ENCRYPTION_KEY || process.env.EMAIL_ENC_KEY;
  const encrypted = fs.readFileSync(filePath);
  const actualSha256 = crypto.createHash('sha256').update(encrypted).digest('hex');

  if (expectedSha256 && actualSha256 !== expectedSha256.trim().split(/\s+/)[0]) {
    throw new Error('Verificación de integridad SHA-256 fallida: el archivo de respaldo fue modificado');
  }

  const compressed = descifrarBufferGcm(encrypted, key);
  const jsonBuffer = zlib.gunzipSync(compressed);
  const dump = JSON.parse(jsonBuffer.toString('utf8'));

  if (dryRun) {
    return {
      dryRun: true,
      createdAt: dump.createdAt,
      collections: Object.keys(dump.collections || {}),
      sha256: actualSha256,
    };
  }

  for (const [colName, docs] of Object.entries(dump.collections || {})) {
    const col = mongoose.connection.db.collection(colName);
    await col.deleteMany({});
    if (Array.isArray(docs) && docs.length > 0) {
      await col.insertMany(docs);
    }
  }

  return {
    restored: true,
    collections: Object.keys(dump.collections || {}),
    sha256: actualSha256,
  };
}

module.exports = { restaurarRespaldoCifrado };
