require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

async function crearUsuario() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Delete if exists
    await Usuario.deleteOne({ email: 'sam@gmail.com' });

    const user = await Usuario.create({
      nombre: 'Samuel',
      email: 'sam@gmail.com',
      password: 'Asdf1234',
      nombreFinca: 'Finca de Samuel'
    });

    console.log('Usuario creado exitosamente:', user.email);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

crearUsuario();
