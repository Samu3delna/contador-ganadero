const mongoose = require('mongoose');
const dns = require('dns');

// DNS fallback para entornos donde el DNS local falla (ej. MongoDB Atlas SRV)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const conectarDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/contador_ganadero');
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error conectando a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { conectarDB };
