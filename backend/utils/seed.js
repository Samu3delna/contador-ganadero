/**
 * Script de inicialización de la base de datos
 * Crea las categorías predeterminadas y opcionalmente un usuario de prueba (SOLO fuera de producción).
 *
 * Para crear también el usuario demo en desarrollo, ejecutar con:
 *   CREATE_DEMO_USER=true DEMO_USER_PASSWORD="TuPasswordFuerte123!" node utils/seed.js
 */

require('dotenv').config({ path: '../.env' });
const crypto = require('crypto');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
  console.error('❌ Ejecución de seed bloqueada en producción por seguridad.');
  process.exit(1);
}

const categoriasSeed = [
  { nombre: 'veterinaria', etiqueta: 'Veterinaria', descripcion: 'Medicamentos, consultas, vacunas, desparasitantes', tasaIVAComun: 2, esDeducible: true, icono: 'Stethoscope', color: '#EF4444' },
  { nombre: 'alimentacion_animal', etiqueta: 'Alimentación Animal', descripcion: 'Concentrados, sales minerales, melaza, pacas', tasaIVAComun: 1, esDeducible: true, icono: 'Wheat', color: '#F59E0B' },
  { nombre: 'maquinaria_equipo', etiqueta: 'Maquinaria y Equipo', descripcion: 'Compra o alquiler de equipo agrícola', tasaIVAComun: 13, esDeducible: true, icono: 'Wrench', color: '#6366F1' },
  { nombre: 'transporte', etiqueta: 'Transporte', descripcion: 'Fletes, transporte de ganado', tasaIVAComun: 13, esDeducible: true, icono: 'Truck', color: '#8B5CF6' },
  { nombre: 'servicios_profesionales', etiqueta: 'Servicios Profesionales', descripcion: 'Contador, abogado, agrónomo', tasaIVAComun: 13, esDeducible: true, icono: 'Briefcase', color: '#0EA5E9' },
  { nombre: 'combustible', etiqueta: 'Combustible', descripcion: 'Diesel, gasolina para maquinaria', tasaIVAComun: 13, esDeducible: true, icono: 'Fuel', color: '#D97706' },
  { nombre: 'mantenimiento', etiqueta: 'Mantenimiento', descripcion: 'Reparaciones de cercas, corrales, instalaciones', tasaIVAComun: 13, esDeducible: true, icono: 'Hammer', color: '#78716C' },
  { nombre: 'seguros', etiqueta: 'Seguros', descripcion: 'Pólizas de ganado, finca, vehículos', tasaIVAComun: 13, esDeducible: true, icono: 'Shield', color: '#14B8A6' },
  { nombre: 'insumos_agropecuarios', etiqueta: 'Insumos Agropecuarios', descripcion: 'Semillas, fertilizantes, alambre, postes', tasaIVAComun: 1, esDeducible: true, icono: 'Sprout', color: '#22C55E' },
  { nombre: 'salarios', etiqueta: 'Salarios', descripcion: 'Planilla de peones, mandadores', tasaIVAComun: 0, esDeducible: true, icono: 'Users', color: '#EC4899' },
  { nombre: 'servicios_publicos', etiqueta: 'Servicios Públicos', descripcion: 'Agua, electricidad, internet, teléfono', tasaIVAComun: 13, esDeducible: true, icono: 'Zap', color: '#3B82F6' },
  { nombre: 'otros', etiqueta: 'Otros', descripcion: 'Gastos no clasificados', tasaIVAComun: 13, esDeducible: true, icono: 'Package', color: '#94A3B8' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB — BD inicializando categorías...');

    // Insertar categorías de forma idempotente (sin borrar existentes)
    const categoriasCol = mongoose.connection.db.collection('categorias');
    for (const cat of categoriasSeed) {
      await categoriasCol.updateOne(
        { nombre: cat.nombre },
        { $set: cat },
        { upsert: true }
      );
    }
    console.log(`🏷️  ${categoriasSeed.length} categorías sincronizadas`);

    // Crear usuario de prueba solo en desarrollo y con contraseña aleatoria o provista por env
    if (process.env.CREATE_DEMO_USER === 'true' && process.env.NODE_ENV !== 'production') {
      const existeUsuario = await Usuario.findOne({ email: 'ganadero@demo.com' });
      if (!existeUsuario) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(12);
        const rawPassword = process.env.DEMO_USER_PASSWORD || `Demo_${crypto.randomBytes(12).toString('base64url')}!9aA`;
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        await Usuario.collection.insertOne({
          nombre: 'Ganadero Demo',
          email: 'ganadero@demo.com',
          password: hashedPassword,
          nombreFinca: 'Finca La Esperanza',
          cedula: { tipo: 'fisica', numero: '123456789' },
          rol: 'owner',
          cantidadHijos: 2,
          tieneConyuge: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log('👤 Usuario de prueba creado para entorno local: ganadero@demo.com');
      } else {
        console.log('👤 Usuario de prueba ya existe');
      }
    }

    console.log('\n✅ Seed completado exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, categoriasSeed };
