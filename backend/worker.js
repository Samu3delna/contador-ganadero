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

console.log('🔧 Iniciando Background Worker IMAP + Hacienda — Contador Ganadero');
console.log('==================================================================');

async function main() {
  // Verificar variables críticas
  const requeridas = ['MONGODB_URI', 'IMAP_USER', 'IMAP_PASSWORD'];
  const faltantes = requeridas.filter(k => !process.env[k] || process.env[k].includes('tu_'));
  
  if (faltantes.length > 0) {
    console.error('❌ Variables de entorno faltantes:', faltantes.join(', '));
    console.error('   Configura estas variables en Render Background Worker');
    process.exit(1);
  }

  try {
    // Conectar a MongoDB
    await conectarDB();
    console.log('✅ MongoDB conectado');

    // Buscar usuario (el primero en BD)
    const usuario = await Usuario.findOne();
    if (!usuario) {
      console.error('❌ No hay usuario en la base de datos');
      console.error('   Registra un usuario desde el frontend primero');
      process.exit(1);
    }
    console.log(`👤 Usuario encontrado: ${usuario.email} (${usuario._id})`);

    // Iniciar listener IMAP
    await iniciarListener(usuario._id);
    console.log('📧 Listener IMAP iniciado correctamente');

    // Sync inicial rápido (solo no leídos)
    console.log('🔄 Ejecutando sincronización inicial (solo no leídos)...');
    const result = await sincronizarManual(usuario._id, { soloNoLeidos: true });
    console.log('📊 Stats:', result.estadisticas);

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