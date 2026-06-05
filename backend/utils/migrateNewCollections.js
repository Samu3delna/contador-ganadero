/**
 * Script de migración para nuevas colecciones de ContadorGanadero
 * Ejecutar: node utils/migrateNewCollections.js
 * 
 * Este script:
 * 1. Crea índices para los nuevos modelos
 * 2. Verifica que las colecciones existan
 * 3. Muestra estado de migración
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    const colecciones = await db.listCollections().toArray();
    const nombresColecciones = colecciones.map(c => c.name);

    console.log('\n📦 Colecciones existentes:', nombresColecciones.join(', '));

    // Verificar/crear colecciones nuevas
    const coleccionesNuevas = ['inventarios', 'costoproduccions', 'facturaemisions'];
    
    for (const collName of coleccionesNuevas) {
      if (!nombresColecciones.includes(collName)) {
        await db.createCollection(collName);
        console.log(`✅ Colección '${collName}' creada`);
      } else {
        console.log(`ℹ️ Colección '${collName}' ya existe`);
      }
    }

    // Crear índices necesarios
    console.log('\n🔧 Creando índices...');
    
    // Inventario
    await db.collection('inventarios').createIndex({ usuario: 1 });
    await db.collection('inventarios').createIndex({ 'bovinos.tagId': 1 });
    await db.collection('inventarios').createIndex({ 'lotesAves.loteId': 1 });
    await db.collection('inventarios').createIndex({ 'estanques.estanqueId': 1 });
    await db.collection('inventarios').createIndex({ 'colmenas.colmenaId': 1 });
    console.log('✅ Índices de inventarios creados');

    // Costos
    await db.collection('costoproduccions').createIndex({ usuario: 1, periodoFiscal: 1 });
    await db.collection('costoproduccions').createIndex({ 'centrosCosto.referenciaId': 1 });
    console.log('✅ Índices de costos creados');

    // Factura Emisión
    await db.collection('facturaemisions').createIndex({ usuario: 1, periodoFiscal: 1, cuatrimestre: 1 });
    await db.collection('facturaemisions').createIndex({ usuario: 1, fechaEmision: -1 });
    await db.collection('facturaemisions').createIndex({ 'emisor.cedula.numero': 1 });
    console.log('✅ Índices de facturaemisions creados');

    // Actualizar schema de Usuarios si es necesario
    const usuarios = db.collection('usuarios');
    const usuarioEjemplo = await usuarios.findOne();
    if (usuarioEjemplo && !usuarioEjemplo.configuracionFiscal) {
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
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  }
}

migrate();
