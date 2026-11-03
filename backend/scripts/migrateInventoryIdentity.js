const mongoose = require('mongoose');
async function migrate({ dryRun = true } = {}) {
  const db = mongoose.connection.db;
  const especificaciones = [
    ['inventarios', { tenantId: 1 }, 'tenant_inventory_unique'],
    ['costoproduccions', { tenantId: 1, periodoFiscal: 1 }, 'tenant_periodo_unique'],
  ];
  const conflictos = [];
  for (const [nombre, campos] of especificaciones) {
    const _id = Object.fromEntries(Object.keys(campos).map(k => [k, `$${k}`]));
    const duplicados = await db.collection(nombre).aggregate([
      { $match: { tenantId: { $type: 'objectId' } } }, { $group: { _id, ids: { $push: '$_id' }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } },
    ]).toArray();
    conflictos.push(...duplicados.map(d => ({ coleccion: nombre, ...d })));
  }
  if (conflictos.length) return { dryRun, aplicado: false, conflictos };
  if (!dryRun) for (const [nombre, campos, name] of especificaciones) {
    await db.collection(nombre).createIndex(campos, { name, unique: true, partialFilterExpression: { tenantId: { $type: 'objectId' } } });
  }
  return { dryRun, aplicado: !dryRun, conflictos };
}
module.exports = { migrate };
if (require.main === module) {
  if (process.env.NODE_ENV !== 'test') require('dotenv').config({ path: require('path').resolve(__dirname, '../..', '.env') });
  mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false }).then(async () => {
    const result = await migrate({ dryRun: process.argv.includes('--dry-run') });
    console.log(JSON.stringify(result)); if (result.conflictos.length) process.exitCode = 2;
  }).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
}
