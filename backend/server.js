const path = require('path');
const crypto = require('crypto');

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
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: envPath });
}

const {
  validarEntorno,
  getAllowedOrigins,
  isOriginAllowed,
  getTrustProxyHops,
} = require('./config/env');

// Validar variables críticas al arrancar (en producción aborta si falta o es débil algún secreto)
validarEntorno({ exitOnError: process.env.NODE_ENV === 'production' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { conectarDB } = require('./config/db');
const { iniciarListener } = require('./services/emailService');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiters');
const { sanitizarEntradasGlobal } = require('./middleware/validateMiddleware');
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
const haciendaConfigRoutes = require('./routes/haciendaConfigRoutes');
const chatRoutes = require('./routes/chatRoutes');
const onvoWebhookRoutes = require('./routes/onvoWebhookRoutes');
const onvoRoutes = require('./routes/onvoRoutes');
const emailWebhookRoutes = require('./routes/emailWebhookRoutes');
const whatsappWebhookRoutes = require('./routes/whatsappWebhookRoutes');
const metaDataDeletionRoutes = require('./routes/metaDataDeletionRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Importar middleware de errores
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Inicializar app
const app = express();

/**
 * Configuración de saltos de proxy de confianza (TRUST_PROXY_HOPS).
 * Valor por defecto: 1 (adecuado detrás de 1 balanceador como Render).
 * Si el tráfico pasa por Cloudflare -> Render, ajustar TRUST_PROXY_HOPS=2 en variables de entorno
 * para que req.ip y express-rate-limit identifiquen la IP real del cliente sin permitir spoofing de X-Forwarded-For.
 */
app.set('trust proxy', getTrustProxyHops());
app.disable('x-powered-by');

// Encabezados de seguridad HTTP estrictos con Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", ...getAllowedOrigins()],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Logging HTTP seguro (sin imprimir cuerpos ni cabeceras Authorization/Cookie)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// CORS — Lista exacta de orígenes permitidos desde CORS_ORIGINS (sin comodines ni coincidencias por sufijo)
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
  maxAge: 600,
};
app.use(cors(corsOptions));

/**
 * Webhook ONVO — se monta ANTES de express.json() global porque el router
 * aplica su propio express.json(). ONVO autentica con X-Webhook-Secret.
 */
app.use('/api/onvo/webhook', onvoWebhookRoutes);

// Límite de 100kb por defecto en JSON y urlencoded para mitigar DoS de memoria
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Sanitización profunda contra Prototype Pollution (__proto__, constructor, prototype)
app.use(sanitizarEntradasGlobal);

// Compatibilidad: si la petición llega como /auth/ en lugar de /api/auth/
app.use((req, res, next) => {
  if (req.url.startsWith('/auth/')) {
    req.url = `/api${req.url}`;
  }
  next();
});

// Rate limiting general y de autenticación
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Health check (Render lo usa para verificar que el servicio está activo; sin exponer detalles sensibles)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    servicio: 'ContadorGanadero API',
    timestamp: new Date().toISOString(),
  });
});

// Cron job endpoint para keep-alive y sync (protegido por CRON_SECRET + allowlist de IP opcional)
app.post('/api/cron/sync-emails', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers['x-cron-secret'];

  if (cronSecret || process.env.NODE_ENV === 'production') {
    if (!cronSecret || !headerSecret || typeof headerSecret !== 'string') {
      return res.status(401).json({ error: 'No autorizado para ejecutar cron' });
    }
    const bufA = Buffer.from(headerSecret);
    const bufB = Buffer.from(cronSecret);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return res.status(401).json({ error: 'No autorizado para ejecutar cron' });
    }
  }

  const allowedIPs = (process.env.CRON_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);
  const clientIP = req.ip || req.connection?.remoteAddress || '';

  if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'IP no autorizada para cron job' });
  }

  try {
    const tieneImap = process.env.IMAP_USER && process.env.IMAP_PASSWORD && !process.env.IMAP_USER.includes('tu_');
    if (tieneImap) {
      const { sincronizarManual } = require('./services/emailService');
      const usuario = await Usuario.findOne();
      if (usuario) {
        const result = await sincronizarManual(usuario._id, { soloNoLeidos: true });
        return res.json({ success: true, keepAlive: true, canal: 'imap', ...result });
      }
    }

    res.json({
      success: true,
      keepAlive: true,
      canal: 'cloudflare-email',
      mensaje: 'Servidor despierto y listo para recibir webhooks.',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.json({ success: true, keepAlive: true });
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
app.use('/api/hacienda', haciendaConfigRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/onvo', onvoRoutes);
app.use('/api/webhooks/email', emailWebhookRoutes);
app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
app.use('/api/webhooks/meta-data-deletion', metaDataDeletionRoutes);
app.use('/api/admin', adminRoutes);

// Servir frontend SPA compilado (Vite dist)
const fs = require('fs');
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Middleware para rutas no encontradas de la API y manejo centralizado de errores
app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT} (${process.env.NODE_ENV || 'development'})`);

    conectarDB()
      .then(async (conectado) => {
        if (!conectado) return;

        if (process.env.IMAP_USER && process.env.IMAP_PASSWORD && !process.env.IMAP_USER.includes('tu_')) {
          try {
            const usuario = await Usuario.findOne();
            if (usuario) {
              await iniciarListener(usuario._id);
            }
          } catch (error) {
            console.error('Error al iniciar listener IMAP:', error.message);
          }
        }

        if (process.env.HACIENDA_WORKER_EMBEDDED === 'true') {
          try {
            const haciendaWorker = require('./services/haciendaWorker');
            haciendaWorker.iniciar(Number(process.env.HACIENDA_WORKER_INTERVAL_MS) || 15000);
          } catch (error) {
            console.error('Error al iniciar worker de Hacienda:', error.message);
          }
        }
      })
      .catch((err) => {
        console.warn('⚠️ No se pudo conectar a MongoDB:', err.message);
      });
  });
}

module.exports = app;
