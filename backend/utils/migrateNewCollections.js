/**
 * Script de migración para nuevas colecciones de ContadorGanadero
 * Ejecutar: node utils/migrateNewCollections.js
 * 
 * Este script:
 * 1. Crea índices para los nuevos modelos
 * 2. Verifica que las colecciones existan
 * 3. Muestra estado de migración
 */


const mongoose = require('mongoose');

async function migrate({ dryRun = true } = {}) {
  try {
    if (mongoose.connection.readyState !== 1) await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    const colecciones = await db.listCollections().toArray();
    const nombresColecciones = colecciones.map(c => c.name);

    console.log('\n📦 Colecciones existentes:', nombresColecciones.join(', '));

    // Verificar/crear colecciones nuevas
    const coleccionesNuevas = ['inventarios', 'costoproduccions', 'facturaemisions'];
    
    for (const collName of coleccionesNuevas) {
      if (!nombresColecciones.includes(collName)) {
        if (!dryRun) await db.createCollection(collName);
        console.log(`✅ Colección '${collName}' creada`);
      } else {
        console.log(`ℹ️ Colección '${collName}' ya existe`);
      }
    }

    // Crear índices necesarios
    console.log('\n🔧 Creando índices...');
    
    // Inventario
    if (!dryRun) await db.collection('inventarios').createIndex({ usuario: 1 });
    if (!dryRun) await db.collection('inventarios').createIndex({ 'bovinos.tagId': 1 });
    if (!dryRun) await db.collection('inventarios').createIndex({ 'lotesAves.loteId': 1 });
    if (!dryRun) await db.collection('inventarios').createIndex({ 'estanques.estanqueId': 1 });
    if (!dryRun) await db.collection('inventarios').createIndex({ 'colmenas.colmenaId': 1 });
    console.log('✅ Índices de inventarios creados');

    // Costos
    if (!dryRun) await db.collection('costoproduccions').createIndex({ usuario: 1, periodoFiscal: 1 });
    if (!dryRun) await db.collection('costoproduccions').createIndex({ 'centrosCosto.referenciaId': 1 });
    console.log('✅ Índices de costos creados');

    // Factura Emisión
    if (!dryRun) await db.collection('facturaemisions').createIndex({ usuario: 1, periodoFiscal: 1, cuatrimestre: 1 });
    if (!dryRun) await db.collection('facturaemisions').createIndex({ usuario: 1, fechaEmision: -1 });
    if (!dryRun) await db.collection('facturaemisions').createIndex({ 'emisor.cedula.numero': 1 });
    console.log('✅ Índices de facturaemisions creados');

    // Actualizar schema de Usuarios si es necesario
    const usuarios = db.collection('usuarios');
    const pendientes = await usuarios.countDocuments({ configuracionFiscal: { $exists: false } });
    if (pendientes && !dryRun) {
      await usuarios.updateMany(
        { configuracionFiscal: { $exists: false } },
        { 
          $set: { 
            configuracionFiscal: {
              actividadEconomica: '',
              regimenTributario: 'Régimen Especial Agropecuario (REA)',
              frecuenciaIVA: 'cuatrimestral',
              depreciacionActivos: []
            }
          } 
        }
      );
      console.log('✅ Usuarios actualizados con configuración fiscal por defecto');
    }

    console.log('\n✅ Migración completada exitosamente');
    return { dryRun, usuariosPendientes: pendientes };
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    throw error;
  }
}

module.exports = { migrate };
if (require.main === module) {
 require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
 migrate({ dryRun: process.argv.includes('--dry-run') }).catch(() => { process.exitCode = 1; }).finally(() => mongoose.disconnect());
}
