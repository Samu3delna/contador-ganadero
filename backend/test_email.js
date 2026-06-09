require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { iniciarListener } = require('./services/emailService');

async function testEmail() {
  try {
    console.log('Conectando a BD...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/contador_ganadero');
    console.log('Conectado a BD. Iniciando sincronización...');
    
    // Asumiendo que el usuario admin tiene un ID o podemos pasar un ID válido
    // Sincronizar emails recibe un idUsuario. En emailService asume buscar un usuario.
    // Vamos a buscar el primer usuario disponible.
    const Usuario = require('./models/Usuario');
    const usuario = await Usuario.findOne();
    if (!usuario) {
      console.log('No hay usuarios en la base de datos.');
      process.exit(1);
    }
    
    await iniciarListener(usuario._id);
    console.log('Esperando 10 segundos para ver si procesa algo...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('Resultado: Revisa los logs arriba.');
    process.exit(0);
  } catch (error) {
    console.error('Error durante test:', error);
    process.exit(1);
  }
}

testEmail();
