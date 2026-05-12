/**
 * Script para crear un usuario desde la línea de comandos
 * Uso: node utils/createUser.js <nombre> <email> <password> [nombreFinca]
 * Ejemplo: node utils/createUser.js "Juan Pérez" juan@email.com MiPass123 "Finca El Progreso"
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

async function crearUsuario() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Uso: node utils/createUser.js <nombre> <email> <password> [nombreFinca]');
    console.log('Ejemplo: node utils/createUser.js "Juan Pérez" juan@email.com MiPass123 "Finca El Progreso"');
    process.exit(1);
  }

  const [nombre, email, password, nombreFinca] = args;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a la base de datos');

    // Delete if exists
    await Usuario.deleteOne({ email });

    const user = await Usuario.create({
      nombre,
      email,
      password,
      nombreFinca: nombreFinca || 'Mi Finca',
    });

    console.log('👤 Usuario creado exitosamente:', user.email);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

crearUsuario();
