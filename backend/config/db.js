const mongoose = require('mongoose');
const dns = require('dns');

// DNS fallback para entornos donde el DNS local falla (ej. MongoDB Atlas SRV)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('No se pudo configurar DNS fallback:', err.message);
}

const conectarDB = async () => {
  try {
    mongoose.set('bufferCommands', false); // Fail fast, avoid hanging queries
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️ MONGODB_URI no configurado — Operando en modo local/desconectado');
      return;
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`⚠️ Base de datos no conectada (${error.message}) — continuando con stubs en memoria`);
  }
};

module.exports = { conectarDB };
