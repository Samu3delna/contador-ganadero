const path = require('path');

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
    { key: 'OPENROUTER_API_KEY', name: 'API Key de OpenRouter (IA)' },
  ];
  const opcionales = [
    { key: 'JWT_SECRET', name: 'JWT Secret (para tokens de autenticación)' },
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

// Importar middleware de errores
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Inicializar app
const app = express();

// Conectar a la base de datos e iniciar listener
conectarDB().then(async () => {
  try {
    const usuario = await Usuario.findOne();
    if (usuario) {
      iniciarListener(usuario._id);
    }
  } catch (error) {
    console.error('Error al iniciar listener IMAP:', error.message);
  }
});

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { error: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
});

// Rate limiting general para la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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

// Middleware para rutas no encontradas
app.use(notFound);

// Middleware centralizado de errores
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
