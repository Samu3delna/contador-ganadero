require('dotenv').config({ path: '../.env' });

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

// Middleware para rutas no encontradas
app.use(notFound);

// Middleware centralizado de errores
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
