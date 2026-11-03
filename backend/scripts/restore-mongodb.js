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
  const dump = mongoose.mongo.BSON.EJSON.parse(jsonBuffer.toString('utf8'), { relaxed: false });
  if (Number(dump.version) !== 2) throw new Error('Respaldo legacy sin tipos BSON: requiere conversión revisada, no se restaurará automáticamente');
  if (!dump.collections || typeof dump.collections !== 'object' || Array.isArray(dump.collections)) throw new Error('Respaldo sin colecciones válidas');
  for (const [name, docs] of Object.entries(dump.collections)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_.-]{0,100}$/.test(name) || name.startsWith('system.') || name.startsWith('_cgr_restore_') || !Array.isArray(docs)) throw new Error('Colección inválida');
    if (docs.some(d => !d || typeof d !== 'object' || Array.isArray(d) || d._id == null)) throw new Error('Documento inválido');
  }

  if (dryRun) {
    return {
      dryRun: true,
      createdAt: dump.createdAt,
      collections: Object.keys(dump.collections || {}),
      sha256: actualSha256,
    };
  }

  const db = mongoose.connection.db;
  const staged = [];
  const suffix = crypto.randomBytes(8).toString('hex');
  try {
    // Stage and validate every collection/index before replacing any live data.
    for (const [name, docs] of Object.entries(dump.collections)) {
      const temp = `_cgr_restore_${suffix}_${staged.length}`;
      const backup = `${temp}_old`;
      const item = { name, temp, backup, oldMoved: false, installed: false };
      staged.push(item);
      await db.createCollection(temp);
      if (docs.length) await db.collection(temp).insertMany(docs);
      for (const index of dump.indexes?.[name] || []) {
        if (index.name === '_id_') continue;
        const { key, name: indexName, unique, sparse, expireAfterSeconds, partialFilterExpression, collation } = index;
        await db.collection(temp).createIndex(key, { name: indexName, ...(unique ? { unique } : {}), ...(sparse ? { sparse } : {}),
          ...(expireAfterSeconds != null ? { expireAfterSeconds: Number(expireAfterSeconds) } : {}), ...(partialFilterExpression ? { partialFilterExpression } : {}), ...(collation ? { collation } : {}) });
      }
    }
    for (const item of staged) {
      const exists = await db.listCollections({ name: item.name }).hasNext();
      if (exists) { await db.collection(item.name).rename(item.backup); item.oldMoved = true; }
      await db.collection(item.temp).rename(item.name); item.installed = true;
    }
  } catch (error) {
    for (const item of [...staged].reverse()) {
      if (item.installed) await db.collection(item.name).drop();
      if (item.oldMoved) await db.collection(item.backup).rename(item.name);
      else if (!item.installed) await db.collection(item.temp).drop().catch(() => {});
    }
    throw error;
  }
  for (const item of staged) if (item.oldMoved) await db.collection(item.backup).drop();

  return {
    restored: true,
    collections: Object.keys(dump.collections || {}),
    sha256: actualSha256,
  };
}

module.exports = { restaurarRespaldoCifrado };

if (require.main === module) {
  if (process.env.NODE_ENV !== 'test') require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
  (async () => {
    const args = process.argv.slice(2);
    const filePath = args.find(a => a.startsWith('--file='))?.slice(7);
    if (!filePath || !process.env.MONGODB_URI) throw new Error('Requiere --file=ruta y MONGODB_URI');
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    const expectedSha256 = fs.existsSync(`${filePath}.sha256`) ? fs.readFileSync(`${filePath}.sha256`, 'utf8') : undefined;
    console.log(JSON.stringify(await restaurarRespaldoCifrado({ filePath, expectedSha256,
      dryRun: args.includes('--dry-run') || !args.includes('--confirm-restore') })));
  })().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
}
