const mongoose = require('mongoose');
const dns = require('dns');
const { logger } = require('../utils/logger');

// Activar sanitización automática de filtros contra operadores NoSQL ($ne, $gt, etc.) y strictQuery
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

// DNS fallback para entornos donde el DNS local falla (ej. MongoDB Atlas SRV)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  logger.warn('No se pudo configurar DNS fallback', { error: err.message });
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
      mongoose.set('bufferCommands', false);
      const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
      if (!uri) {
        logger.error('MONGODB_URI no configurado');
        return false;
      }
      const isProd = process.env.NODE_ENV === 'production';
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 20,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        autoIndex: !isProd,
      });
      logger.info(`MongoDB conectado: ${conn.connection.host}`);
      return true;
    } catch (error) {
      logger.error('Error conectando a MongoDB', { error: error.message });
      return false;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

module.exports = { conectarDB };
