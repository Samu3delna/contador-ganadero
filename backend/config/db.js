const mongoose = require('mongoose');
const dns = require('dns');

// DNS fallback para entornos donde el DNS local falla (ej. MongoDB Atlas SRV)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('No se pudo configurar DNS fallback:', err.message);
}

let connectionPromise = null;

const conectarDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      mongoose.set('bufferCommands', false); // Fail fast, avoid hanging queries
      if (!process.env.MONGODB_URI) {
        console.warn('⚠️ MONGODB_URI no configurado — Operando en modo local/desconectado');
        return false;
      }
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
      });
      console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Base de datos no conectada (${error.message}) — continuando con stubs en memoria`);
      return false;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

module.exports = { conectarDB };
