const mongoose = require('mongoose');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const execFile = promisify(require('child_process').execFile);
const { crearRespaldoCifrado, cifrarBufferGcm } = require('../scripts/backup-mongodb');
const { restaurarRespaldoCifrado } = require('../scripts/restore-mongodb');
const Tenant = require('../models/Tenant');
const Usuario = require('../models/Usuario');
const Factura = require('../models/Factura');
const key = '0123456789abcdef'.repeat(4);
let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgr-backup-test-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('F-19: BSON ObjectId, Date, Binary y Long sobreviven backup/restore y dry-run no reemplaza datos', async () => {
  const col = mongoose.connection.db.collection('prueba_bson');
  const id = new mongoose.Types.ObjectId();
  await col.insertOne({ _id: id, tenantId: new mongoose.Types.ObjectId(), fecha: new Date('2026-01-02T00:00:00Z'),
    bin: new mongoose.mongo.BSON.Binary(Buffer.from([1,2,3])), entero: mongoose.mongo.BSON.Long.fromString('9007199254740995') });
  const backup = await crearRespaldoCifrado({ outputDir: dir, encryptionKey: key });
  await col.updateOne({ _id: id }, { $set: { marcador: true } });
  await restaurarRespaldoCifrado({ filePath: backup.filePath, encryptionKey: key, expectedSha256: backup.sha256 });
  expect((await col.findOne({ _id: id })).marcador).toBe(true);
  await restaurarRespaldoCifrado({ filePath: backup.filePath, encryptionKey: key, dryRun: false });
  const doc = await mongoose.connection.db.collection('prueba_bson').findOne({ _id: id });
  expect(doc.tenantId).toBeInstanceOf(mongoose.Types.ObjectId); expect(doc.fecha).toBeInstanceOf(Date);
  expect(doc.bin._bsontype).toBe('Binary'); expect(doc.entero.toString()).toBe('9007199254740995'); expect(doc.marcador).toBeUndefined();
});
test('F-19: legacy ambiguo se rechaza sin tocar colecciones', async () => {
  const filePath = path.join(dir, 'legacy.cgbk');
  fs.writeFileSync(filePath, cifrarBufferGcm(require('zlib').gzipSync(Buffer.from(JSON.stringify({ version: 1, collections: {} }))), key));
  await expect(restaurarRespaldoCifrado({ filePath, encryptionKey: key, dryRun: false })).rejects.toThrow(/legacy/);
});
test('P-06: CLI crea respaldo y dry-run no crea archivos', async () => {
  const cli = path.resolve(__dirname, '../scripts/backup-mongodb.js');
  const env = { ...process.env, MONGODB_URI: mongoose.connection.client.s.url, BACKUP_ENCRYPTION_KEY: key, NODE_ENV: 'test' };
  const dry = await execFile(process.execPath, [cli, `--output-dir=${dir}`, '--dry-run'], { env });
  expect(JSON.parse(dry.stdout).dryRun).toBe(true); expect(fs.readdirSync(dir)).toHaveLength(0);
  const done = await execFile(process.execPath, [cli, `--output-dir=${dir}`], { env });
  expect(fs.existsSync(JSON.parse(done.stdout).filePath)).toBe(true);
});
test('S-07: usuario ya asociado reanuda documentos null y ausentes sin crear otra finca', async () => {
  const u = await Usuario.create({nombre:'Migracion',email:'migration@example.test',password:'SyntheticPassword123!'});
  const t = await Tenant.crearParaUsuario({nombreFinca:'Existente',owner:u._id});
  u.tenantId=t._id; await u.save();
  await Factura.collection.insertMany([{usuario:u._id,tenantId:null},{usuario:u._id}]);
  const { migrarUsuario } = require('../scripts/migrateTenant');
  expect((await migrarUsuario(u,{dryRun:true})).docsActualizados).toBe(2);
  expect(await Factura.collection.countDocuments({tenantId:t._id})).toBe(0);
  expect((await migrarUsuario(u,{dryRun:false})).docsActualizados).toBe(2);
  expect((await migrarUsuario(u,{dryRun:false})).docsActualizados).toBe(0);
  expect(await Tenant.countDocuments()).toBe(1);
});
test('S-15: dry-run no crea colecciones/indices ni actualiza usuarios; aplicacion idempotente', async () => {
  const { migrate } = require('../utils/migrateNewCollections');
  const db = mongoose.connection.db;
  await db.collection('usuarios').insertMany([{nombre:'Ya configurado',email:'configured@example.test',configuracionFiscal:{}},{nombre:'Pendiente',email:'pending@example.test'}]);
  const before = await db.listCollections().toArray();
  const dry = await migrate({dryRun:true}); expect(dry.usuariosPendientes).toBe(1);
  expect((await db.listCollections().toArray()).map(c=>c.name).sort()).toEqual(before.map(c=>c.name).sort());
  expect(await db.collection('usuarios').countDocuments({configuracionFiscal:{$exists:false}})).toBe(1);
  await migrate({dryRun:false}); expect((await migrate({dryRun:false})).usuariosPendientes).toBe(0);
});
test('P-10/S-08: migra campos reales, certifica roundtrip y no adivina AAD incorrecto', async () => {
  const crypto = require('../utils/crypto');
  const t = await Tenant.create({nombreFinca:'Cripto'});
  await Tenant.collection.updateOne({_id:t._id},{$set:{'configuracionHacienda.certificadoP12Base64':'synthetic-base64','configuracionHacienda.pinCertificado':'1234',
    'configuracionHacienda.passwordHacienda':crypto.encryptSecret('invalido',{tenantId:'otra-finca',fieldName:'configuracionHacienda.passwordHacienda'})}});
  const { migrateTenants } = require('../scripts/migrateCryptoGcm');
  const dry = await migrateTenants({dryRun:true}); expect(dry.migrados).toBe(1); expect(dry.pendientesReconfiguracion).toHaveLength(1);
  expect((await Tenant.collection.findOne({_id:t._id})).configuracionHacienda.pinCertificado).toBe('1234');
  await migrateTenants({dryRun:false});
  const current = await Tenant.findById(t._id).select('+configuracionHacienda.pinCertificado +configuracionHacienda.certificadoP12Base64');
  expect(current.configuracionHacienda.obtenerPinCertificado()).toBe('1234');
  expect(current.configuracionHacienda.obtenerCertificadoP12()).toBe('synthetic-base64');
  expect((await migrateTenants({dryRun:false})).migrados).toBe(0);
});
