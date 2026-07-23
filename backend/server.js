const path = require('path');

// DNS fallback para entornos donde el DNS local falla (MongoDB Atlas, Gmail IMAP)
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('No se pudo configurar DNS fallback:', err.message);
}

// Cargar .env desde la raíz del proyecto de forma robusta
const envPath = path.resolve(__dirname, '..', '.env');
const dotenv = require('dotenv');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('⚠️  No se encontró archivo .env en la raíz del proyecto.');
  console.warn('   Copia .env.example a .env y rellena tus credenciales reales.');
}

// Verificador de configuración crítica
function verificarConfig() {
  const requeridas = [
    { key: 'MONGODB_URI', name: 'Base de Datos (MongoDB)' },
    { key: 'IMAP_USER', name: 'Usuario IMAP (correo)' },
    { key: 'IMAP_PASSWORD', name: 'Contraseña IMAP' },
    { key: 'AI_API_KEY', name: 'API Key de NVIDIA (IA)' },
    { key: 'JWT_SECRET', name: 'JWT Secret (para tokens de autenticación)' },
  ];
  const opcionales = [
  ];

  let ok = true;
  console.log('🔍 Verificando configuración del servidor...\n');

  for (const req of requeridas) {
    const val = process.env[req.key];
    if (!val || val.includes('tu_') || val.includes('ejemplo')) {
      console.error(`   ❌ ${req.key} (${req.name}): NO CONFIGURADO o es un valor de ejemplo.`);
      ok = false;
    } else {
      console.log(`   ✅ ${req.key}: configurado`);
    }
  }

  for (const opt of opcionales) {
    const val = process.env[opt.key];
    if (!val) {
      console.warn(`   ⚠️  ${opt.key} (${opt.name}): no configurado (opcional, pero recomendado).`);
    } else {
      console.log(`   ✅ ${opt.key}: configurado`);
    }
  }

  console.log('');
  if (!ok) {
    console.error('🚨 CONFIGURACIÓN INCOMPLETA: El servidor arrancará, pero IMAP y/o IA no funcionarán.');
    console.error('   → Crea el archivo .env en la raíz del proyecto basándote en .env.example\n');
  } else {
    console.log('✅ Todas las configuraciones críticas están presentes.\n');
  }
  return ok;
}

verificarConfig();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { conectarDB } = require('./config/db');
const { iniciarListener } = require('./services/emailService');
const Usuario = require('./models/Usuario');

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const ingresoRoutes = require('./routes/ingresoRoutes');
const facturaRoutes = require('./routes/facturaRoutes');
const impuestoRoutes = require('./routes/impuestoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const declaracionRoutes = require('./routes/declaracionRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const costoRoutes = require('./routes/costoRoutes');
const facturaEmisionRoutes = require('./routes/facturaEmisionRoutes');
const haciendaRoutes = require('./routes/haciendaRoutes');
const chatRoutes = require('./routes/chatRoutes');
const stripeWebhookRoutes = require('./routes/stripeWebhookRoutes');
const stripeRoutes = require('./routes/stripeRoutes');

// Importar middleware de errores
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Inicializar app
const app = express();

// Middlewares de seguridad
app.use(helmet());
app.use(morgan('dev'));

// CORS — configuración dinámica para evitar bloqueos
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir si no hay origen (postman, mobile, etc), localhost o el dominio de vercel
    if (!origin || origin.includes('localhost') || origin.includes('contador-ganadero.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

/**
 * Webhook Stripe — DEBE montarse ANTES de express.json() para recibir raw body.
 * Stripe firma el body crudo; si se parsea a JSON primero, la firma falla.
 * Rate limiters globales NO aplican a este router (específicamente excluido)
 * porque Stripe necesita entregar el webhook sin límites.
 */
app.use('/api/stripe/webhook', stripeWebhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { error: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
});

// Rate limiting general para la API (excluye webhook Stripe)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: (req) => req.path === '/api/stripe/webhook',
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Health check (Render lo usa para verificar que el servicio está activo)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    servicio: 'ContadorGanadero API',
    entorno: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Cron job endpoint para sync de emails (sin auth, solo IP allowlist opcional)
// Usado por cron-job.org / UptimeRobot como backup si el Background Worker falla
app.post('/api/cron/sync-emails', async (req, res) => {
  // Opcional: verificar IP de cron jobs conocidos
  const allowedIPs = (process.env.CRON_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);
  const clientIP = req.ip || req.connection?.remoteAddress || '';
  
  if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
    console.warn(`⚠️  Cron job bloqueado - IP no autorizada: ${clientIP}`);
    return res.status(403).json({ error: 'IP no autorizada para cron job' });
  }

  try {
    const { sincronizarManual } = require('./services/emailService');
    const Usuario = require('./models/Usuario');
    
    const usuario = await Usuario.findOne();
    if (!usuario) return res.status(404).json({ error: 'No hay usuario configurado' });
    
    const result = await sincronizarManual(usuario._id, { soloNoLeidos: true });
    console.log('✅ Cron sync completado:', result.estadisticas);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('❌ Error en cron sync:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Registrar rutas
app.use('/api/auth', authRoutes);
app.use('/api/ingresos', ingresoRoutes);
app.use('/api/facturas', facturaRoutes);
app.use('/api/impuestos', impuestoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/declaraciones', declaracionRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/costos', costoRoutes);
app.use('/api/facturacion', facturaEmisionRoutes);
app.use('/api/hacienda', haciendaRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/stripe', stripeRoutes);

console.log('📋 Rutas registradas:');
console.log('   /api/auth (incluye /refresh, /logout)');
console.log('   /api/ingresos');
console.log('   /api/facturas');
console.log('   /api/impuestos');
console.log('   /api/dashboard');
console.log('   /api/declaraciones');
console.log('   /api/inventario');
console.log('   /api/costos');
console.log('   /api/facturacion');
console.log('   /api/hacienda (v4.4 nativa)');
console.log('   /api/chat (incluye /stream)');
console.log('   /api/stripe (checkout, portal, estado, webhook)');

// Middleware para rutas no encontradas
app.use(notFound);

// Middleware centralizado de errores
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT} (${process.env.NODE_ENV || 'development'})`);

  // Iniciar listener IMAP después de que el servidor esté escuchando
  if (process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
    conectarDB().then(async () => {
      try {
        const usuario = await Usuario.findOne();
        if (usuario) {
          await iniciarListener(usuario._id);
        }
      } catch (error) {
        console.error('Error al iniciar listener IMAP:', error.message);
      }
    });
  }

  // Iniciar worker asíncrono de Hacienda en el propio servidor (modo dev/test)
  // En producción debe correr como Background Worker separado (worker.js)
  if (process.env.HACIENDA_WORKER_EMBEDDED === 'true' || (process.env.NODE_ENV !== 'production' && process.env.HACIENDA_AMBIENTE)) {
    conectarDB().then(() => {
      try {
        const haciendaWorker = require('./services/haciendaWorker');
        haciendaWorker.iniciar(Number(process.env.HACIENDA_WORKER_INTERVAL_MS) || 15000);
      } catch (error) {
        console.error('Error al iniciar worker de Hacienda:', error.message);
      }
    });
  }
});
