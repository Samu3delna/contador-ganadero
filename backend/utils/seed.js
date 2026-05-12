/**
 * Script de inicialización de la base de datos
 * Crea las categorías predeterminadas y opcionalmente un usuario de prueba
 * 
 * Para crear también el usuario demo, ejecutar con:
 *   CREATE_DEMO_USER=true node utils/seed.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Categoria = require('../models/Categoria');
const Usuario = require('../models/Usuario');

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
    console.log('✅ Conectado a MongoDB Atlas — BD: contador_ganadero');

    // Insertar categorías
    await Categoria.deleteMany({});
    const cats = await Categoria.insertMany(categoriasSeed);
    console.log(`🏷️  ${cats.length} categorías creadas`);

    // Crear usuario de prueba solo si se solicita explícitamente
    if (process.env.CREATE_DEMO_USER === 'true') {
      const existeUsuario = await Usuario.findOne({ email: 'ganadero@demo.com' });
      if (!existeUsuario) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(12);
        // En producción/despliegue, cambiar esta contraseña o eliminar el usuario demo
        const hashedPassword = await bcrypt.hash('DemoSeguro2026!', salt);

        await Usuario.collection.insertOne({
          nombre: 'Ganadero Demo',
          email: 'ganadero@demo.com',
          password: hashedPassword,
          nombreFinca: 'Finca La Esperanza',
          cedula: { tipo: 'fisica', numero: '123456789' },
          cantidadHijos: 2,
          tieneConyuge: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log('👤 Usuario de prueba creado: ganadero@demo.com / DemoSeguro2026!');
        console.log('   ⚠️  IMPORTANTE: Elimina este usuario antes de pasar a producción.');
      } else {
        console.log('👤 Usuario de prueba ya existe');
      }
    } else {
      console.log('   ℹ️  Saltando creación de usuario demo. Usa CREATE_DEMO_USER=true para crearlo.');
    }

    // Listar colecciones creadas
    const colecciones = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📦 Colecciones en la base de datos:');
    colecciones.forEach(c => console.log(`   - ${c.name}`));

    console.log('\n✅ Seed completado exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error.message);
    process.exit(1);
  }
}

seed();
