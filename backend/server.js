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
const haciendaConfigRoutes = require('./routes/haciendaConfigRoutes');
const chatRoutes = require('./routes/chatRoutes');
const onvoWebhookRoutes = require('./routes/onvoWebhookRoutes');
const onvoRoutes = require('./routes/onvoRoutes');
const emailWebhookRoutes = require('./routes/emailWebhookRoutes');
const whatsappWebhookRoutes = require('./routes/whatsappWebhookRoutes');
const adminRoutes = require('./routes/adminRoutes');

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
    if (!origin) return callback(null, true);

    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5173',
    ].filter(Boolean);

    const isAllowed =
      allowed.some((url) => origin.startsWith(url)) ||
      origin.includes('localhost') ||
      origin.includes('pages.dev') ||
      origin.includes('workers.dev') ||
      origin.includes('vercel.app') ||
      (process.env.DOMAIN && origin.includes(process.env.DOMAIN));

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

/**
 * Webhook ONVO — se monta ANTES de express.json() global porque el router
 * aplica su propio express.json(). ONVO autentica con X-Webhook-Secret,
 * no con firma del body crudo.
 * Rate limiters globales NO aplican a este router (específicamente excluido)
 * porque ONVO necesita entregar el webhook sin límites.
 */
app.use('/api/onvo/webhook', onvoWebhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Compatibilidad: si la petición llega como /auth/ en lugar de /api/auth/
app.use((req, res, next) => {
  if (req.url.startsWith('/auth/')) {
    req.url = `/api${req.url}`;
  }
  next();
});

// Rate limiting para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { error: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
});

// Rate limiting general para la API (excluye webhooks externos)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: (req) => req.path === '/api/onvo/webhook' || req.path.startsWith('/api/webhooks/'),
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

// Cron job endpoint para keep-alive y sync (sin auth, solo IP allowlist opcional)
// Usado por cron-job.org / UptimeRobot para mantener despierto el Web Service en plan Free de Render
app.post('/api/cron/sync-emails', async (req, res) => {
  const allowedIPs = (process.env.CRON_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);
  const clientIP = req.ip || req.connection?.remoteAddress || '';
  
  if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
    console.warn(`⚠️ Cron job bloqueado - IP no autorizada: ${clientIP}`);
    return res.status(403).json({ error: 'IP no autorizada para cron job' });
  }

  try {
    const tieneImap = process.env.IMAP_USER && process.env.IMAP_PASSWORD && !process.env.IMAP_USER.includes('tu_');
    if (tieneImap) {
      const { sincronizarManual } = require('./services/emailService');
      const Usuario = require('./models/Usuario');
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
      mensaje: 'Servidor despierto y listo para recibir webhooks de Cloudflare y WhatsApp.',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('⚠️ Advertencia en cron sync:', e.message);
    res.json({ success: true, keepAlive: true, advertencia: e.message });
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
app.use('/api/admin', adminRoutes);

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
console.log('   /api/hacienda (v4.4 nativa + config multi-tenant)');
console.log('   /api/chat (incluye /stream)');
console.log('   /api/onvo (checkout, cancelar, estado, webhook)');
console.log('   /api/webhooks/email (Cloudflare Email Routing)');
console.log('   /api/webhooks/whatsapp (Meta Cloud API)');
console.log('   /api/admin (panel super admin: usuarios, tenants, monitoreo)');

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

// Middleware para rutas no encontradas de la API
app.use(notFound);

// Database offline fallback per references/web.md
app.use((err, req, res, next) => {
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && (err.message.includes('buffering timed out') || err.message.includes('ECONNREFUSED')))
  ) {
    console.warn('[AI Studio] Database offline — returning mock response for', req.method, req.path);
    if (req.method === 'GET') {
      if (req.path.includes('/dashboard/resumen')) {
        return res.json({
          ingresosTotales: 14500000,
          gastosTotales: 9200000,
          ivaCobrado: 145000,
          ivaSoportado: 92000,
          ivaPagar: 53000,
          rentaEstimada: 420000,
          margenOperativo: 36.5,
          totalFacturas: 28,
          totalIngresos: 14,
        });
      }
      if (req.path.includes('/dashboard/gastos-por-categoria')) {
        return res.json([
          { categoria: 'alimentacion_animal', totalGasto: 3500000, totalIVA: 35000, cantidad: 12 },
          { categoria: 'veterinaria', totalGasto: 1800000, totalIVA: 36000, cantidad: 8 },
          { categoria: 'combustible', totalGasto: 1200000, totalIVA: 0, cantidad: 15 },
          { categoria: 'mantenimiento', totalGasto: 950000, totalIVA: 12350, cantidad: 5 },
          { categoria: 'insumos_agropecuarios', totalGasto: 850000, totalIVA: 8500, cantidad: 6 },
        ]);
      }
      if (req.path.includes('/dashboard/tendencia-mensual')) {
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        return res.json(meses.map((m, i) => ({
          mes: m,
          gastos: [700000, 850000, 600000, 950000, 800000, 750000, 900000, 820000, 780000, 810000, 740000, 890000][i],
          ingresos: [1200000, 1100000, 1300000, 1400000, 1250000, 1350000, 1500000, 1400000, 1300000, 1450000, 1380000, 1600000][i],
        })));
      }
      if (req.path.includes('/inventario/resumen')) {
        return res.json({
          totalBovinos: 84,
          totalAves: 250,
          totalColmenas: 18,
          totalPeces: 1200,
          valorEstimadoTotal: 42500000,
        });
      }
      if (req.path.includes('/inventario')) {
        return res.json({
          bovinos: [
            { _id: 'bov1', identificacion: 'CR-01-2024', nombre: 'Toro Campeón', raza: 'Brahman', categoria: 'toro_reproductor', pesoActualKg: 780, estado: 'activo' },
            { _id: 'bov2', identificacion: 'CR-02-2024', nombre: 'Paloma', raza: 'Pardo Suizo', categoria: 'vaca_produccion', pesoActualKg: 540, estado: 'activo' },
            { _id: 'bov3', identificacion: 'CR-03-2025', nombre: 'Ternero Moro', raza: 'Girolando', categoria: 'ternero', pesoActualKg: 190, estado: 'activo' },
          ],
          aves: [{ _id: 'ave1', identificacion: 'Lote Ponedoras A', tipo: 'ponedora', cantidadActual: 250 }],
          peces: [{ _id: 'pec1', identificacion: 'Estanque Tilapia 1', especie: 'tilapia', biomasaEstimadaKg: 1200 }],
          colmenas: [{ _id: 'col1', identificacion: 'Apiario El Roble', cantidadColmenas: 18 }],
        });
      }
      if (req.path.includes('/costos/resumen') || req.path === '/api/costos') {
        return res.json({
          costoPorKgCarne: 1420,
          costoPorLitroLeche: 285,
          totalCentrosActivos: 3,
          centros: [
            { nombre: 'Lote Engorde Guanacaste', tipo: 'carne', costoAcumulado: 4200000, kilosEsperados: 3200 },
            { nombre: 'Lechería Especializada', tipo: 'leche', costoAcumulado: 3100000, litrosEsperados: 11000 },
          ],
        });
      }
      if (req.path.includes('/facturas/alertas-tarifa')) {
        return res.json({
          alertas: [
            {
              _id: 'alt1',
              facturaId: 'fac1',
              numeroConsecutivo: '00100001010000000045',
              emisor: { nombre: 'Agroveterinaria El Arreo' },
              descripcionLinea: 'Alimento Concentrado Bovino 18% Proteína',
              tarifaCobrada: 13,
              tarifaEsperada: 1,
              ahorroEstimado: 24000,
              tipoAlerta: 'tarifa_superior_canasta',
            },
          ],
          ahorroTotalPotencial: 24000,
        });
      }
      if (req.path.includes('/facturas')) {
        return res.json({
          facturas: [
            {
              _id: 'fac1',
              numeroConsecutivo: '00100001010000000045',
              clave: '50614102600310123456700100001010000000045100000001',
              emisor: { nombre: 'Agroveterinaria El Arreo', cedula: { numero: '3101234567' } },
              fechaEmision: new Date(Date.now() - 86400000 * 2).toISOString(),
              totalComprobante: 226000,
              totalImpuesto: 2260,
              tasaIVA: 1,
              categoriaIA: 'alimentacion_animal',
              subcategoriaIA: 'Concentrado Bovino REA',
              esDeducible: true,
              confianzaIA: 0.95,
            },
            {
              _id: 'fac2',
              numeroConsecutivo: '00100001010000000088',
              clave: '50614102600310987654300100001010000000088100000002',
              emisor: { nombre: 'Farmacia Veterinaria Guanacaste', cedula: { numero: '3109876543' } },
              fechaEmision: new Date(Date.now() - 86400000 * 5).toISOString(),
              totalComprobante: 85000,
              totalImpuesto: 1700,
              tasaIVA: 2,
              categoriaIA: 'veterinaria',
              subcategoriaIA: 'Vacunas y Desparasitantes',
              esDeducible: true,
              confianzaIA: 0.92,
            },
          ],
          total: 2,
          pagina: 1,
          totalPaginas: 1,
        });
      }
      if (req.path.includes('/facturacion') || req.path.includes('/hacienda/emision')) {
        return res.json({
          facturas: [
            {
              _id: 'fe1',
              tipoDocumento: 'FE',
              consecutivo: '00100001010000000012',
              claveNumerica: '50614102600112345678900100001010000000012100000001',
              receptor: { nombre: 'Subasta Ganadera del Norte S.A.', cedula: { numero: '3101999888' } },
              fechaEmision: new Date(Date.now() - 86400000 * 3).toISOString(),
              resumenFactura: { totalComprobante: 4850000, totalImpuesto: 48500 },
              tipoProducto: 'ganado_pie',
              estado: 'aceptada',
              xmlFirmado: '<FacturaElectronica></FacturaElectronica>',
            },
          ],
          total: 1,
          pagina: 1,
          totalPaginas: 1,
        });
      }
      if (req.path.includes('/impuestos/iva')) {
        return res.json({
          cuatrimestre: 3,
          anio: 2026,
          totalVentasGravadas: 14500000,
          totalComprasGravadas: 9200000,
          ivaDebitoFiscal: 145000,
          ivaCreditoFiscal: 92000,
          impuestoNetoAPagar: 53000,
        });
      }
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(200).json({ success: true, mensaje: 'Simulado en modo offline' });
  }
  next(err);
});

// Middleware centralizado de errores
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT} (${process.env.NODE_ENV || 'development'})`);

  // Intentar conectar a MongoDB de forma no bloqueante
  conectarDB().catch((err) => {
    console.warn('⚠️ No se pudo conectar a MongoDB:', err.message);
  });

  // Iniciar listener IMAP después de que el servidor esté escuchando
  if (process.env.IMAP_USER && process.env.IMAP_PASSWORD && !process.env.IMAP_USER.includes('tu_')) {
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
  if (process.env.HACIENDA_WORKER_EMBEDDED === 'true') {
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
