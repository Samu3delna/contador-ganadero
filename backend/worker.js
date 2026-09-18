const path = require('path');

// DNS fallback para entornos donde el DNS local falla (MongoDB Atlas, Gmail IMAP)
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('No se pudo configurar DNS fallback:', err.message);
}

// Cargar .env desde la raíz del proyecto
const envPath = path.resolve(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

const { conectarDB } = require('./config/db');
const { iniciarListener, sincronizarManual, detenerListener } = require('./services/emailService');
const haciendaWorker = require('./services/haciendaWorker');
const Usuario = require('./models/Usuario');

console.log('🔧 Iniciando Background Worker — Contador Ganadero');
console.log('====================================================');

async function main() {
  // Verificar variable crítica de base de datos
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('tu_usuario')) {
    console.error('❌ MONGODB_URI no configurado en variables de entorno');
    process.exit(1);
  }

  try {
    // Conectar a MongoDB
    await conectarDB();
    console.log('✅ MongoDB conectado');

    // Iniciar listener IMAP únicamente si las credenciales están configuradas
    const tieneImap = process.env.IMAP_USER && process.env.IMAP_PASSWORD && !process.env.IMAP_USER.includes('tu_');
    if (tieneImap) {
      const usuario = await Usuario.findOne();
      if (usuario) {
        console.log(`📧 Credenciales IMAP detectadas para: ${process.env.IMAP_USER}`);
        try {
          await iniciarListener(usuario._id);
          console.log('📧 Listener IMAP iniciado correctamente');
          const result = await sincronizarManual(usuario._id, { soloNoLeidos: true });
          console.log('📊 Stats IMAP:', result.estadisticas);
        } catch (err) {
          console.warn('⚠️ No se pudo conectar a IMAP:', err.message);
        }
      }
    } else {
      console.log('ℹ️ IMAP no configurado. La ingesta principal opera en tiempo real vía Cloudflare Email Worker y WhatsApp.');
    }

    // Iniciar worker asíncrono de envío a Hacienda (facturación v4.4)
    const ambienteHacienda = process.env.HACIENDA_AMBIENTE || 'local';
    console.log(`🧾 Iniciando worker de Hacienda (ambiente: ${ambienteHacienda})...`);
    haciendaWorker.iniciar(Number(process.env.HACIENDA_WORKER_INTERVAL_MS) || 15000);

    // Mantener proceso vivo
    console.log('✅ Worker corriendo. Presiona Ctrl+C para detener.');

    // Manejar señales de apagado
    process.on('SIGTERM', async () => {
      console.log('\n🛑 SIGTERM recibido, cerrando worker...');
      haciendaWorker.detener();
      await detenerListener();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 SIGINT recibido, cerrando worker...');
      haciendaWorker.detener();
      await detenerListener();
      process.exit(0);
    });

  } catch (error) {
    console.error('💥 Error fatal en worker:', error);
    process.exit(1);
  }
}

main();