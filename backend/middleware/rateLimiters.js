/**
 * Limitadores de tasa (Rate Limiting) granulares por tipo de operación.
 * Todos activan cabeceras estándar RFC (RateLimit-*) y desactivan X-RateLimit-* legadas.
 * Los umbrales son configurables mediante variables de entorno.
 */

const rateLimit = require('express-rate-limit');

function crearLimiter({ windowMsEnv, maxEnv, defaultWindowMs, defaultMax, windowMs, max, mensaje, message, keyGenerator, skip }) {
  const effectiveWindowMs =
    (windowMsEnv && Number.parseInt(process.env[windowMsEnv], 10)) ||
    windowMs ||
    defaultWindowMs ||
    15 * 60 * 1000;

  const isTest = process.env.NODE_ENV === 'test';
  const envMax = maxEnv ? Number.parseInt(process.env[maxEnv], 10) : NaN;
  const effectiveMax =
    !Number.isNaN(envMax) && envMax > 0
      ? envMax
      : max || (isTest ? Math.max(defaultMax || 100, 500) : defaultMax || 100);

  const msgText = mensaje || message || 'Demasiadas solicitudes. Intenta más tarde.';

  return rateLimit({
    windowMs: effectiveWindowMs,
    max: effectiveMax,
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    ...(skip ? { skip } : {}),
    message: typeof msgText === 'object' ? msgText : { error: msgText, codigo: 'RATE_LIMIT_EXCEEDED' },
  });
}

// Alias compatible con tests y uso programático
const createRateLimiter = crearLimiter;

// Límite general de la API (200 peticiones / 15 minutos, excluyendo webhooks)
const apiLimiter = crearLimiter({
  windowMsEnv: 'RL_API_WINDOW_MS',
  maxEnv: 'RL_API_MAX',
  defaultWindowMs: 15 * 60 * 1000,
  defaultMax: 200,
  mensaje: 'Demasiadas solicitudes a la API. Intenta de nuevo más tarde.',
  skip: (req) => req.path === '/api/onvo/webhook' || req.path.startsWith('/api/webhooks/'),
});

// Límite general para el router /api/auth (30 peticiones / 15 minutos)
const authLimiter = crearLimiter({
  windowMsEnv: 'RL_AUTH_WINDOW_MS',
  maxEnv: 'RL_AUTH_MAX',
  defaultWindowMs: 15 * 60 * 1000,
  defaultMax: 30,
  mensaje: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
});

// Límite estricto para inicio de sesión y verificación MFA (8 intentos / 15 minutos)
const loginLimiter = crearLimiter({
  windowMsEnv: 'RL_LOGIN_WINDOW_MS',
  maxEnv: 'RL_LOGIN_MAX',
  defaultWindowMs: 15 * 60 * 1000,
  defaultMax: 8,
  mensaje: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.',
});

// Límite para registro de cuentas nuevas (5 registros / 60 minutos por IP)
const registerLimiter = crearLimiter({
  windowMsEnv: 'RL_REGISTER_WINDOW_MS',
  maxEnv: 'RL_REGISTER_MAX',
  defaultWindowMs: 60 * 60 * 1000,
  defaultMax: 5,
  mensaje: 'Demasiados intentos de registro desde esta dirección. Intenta más tarde.',
});

// Límite para recuperación y restablecimiento de contraseña (5 solicitudes / 60 minutos)
const passwordResetLimiter = crearLimiter({
  windowMsEnv: 'RL_RESET_WINDOW_MS',
  maxEnv: 'RL_RESET_MAX',
  defaultWindowMs: 60 * 60 * 1000,
  defaultMax: 5,
  mensaje: 'Demasiadas solicitudes de recuperación de contraseña. Intenta en una hora.',
});

// Límite para subida de archivos XML y certificados .p12 (20 subidas / 15 minutos)
const uploadLimiter = crearLimiter({
  windowMsEnv: 'RL_UPLOAD_WINDOW_MS',
  maxEnv: 'RL_UPLOAD_MAX',
  defaultWindowMs: 15 * 60 * 1000,
  defaultMax: 20,
  mensaje: 'Límite de subida de archivos excedido. Intenta más tarde.',
});

// Límite para endpoints de Inteligencia Artificial (10 consultas / minuto)
const aiLimiter = crearLimiter({
  windowMsEnv: 'RL_AI_WINDOW_MS',
  maxEnv: 'RL_AI_MAX',
  defaultWindowMs: 60 * 1000,
  defaultMax: 10,
  mensaje: 'Demasiadas consultas al asistente IA. Espera un minuto antes de continuar.',
});

// Límite para emisión y firma de comprobantes electrónicos Hacienda (30 emisiones / 15 minutos)
const emisionLimiter = crearLimiter({
  windowMsEnv: 'RL_EMISION_WINDOW_MS',
  maxEnv: 'RL_EMISION_MAX',
  defaultWindowMs: 15 * 60 * 1000,
  defaultMax: 30,
  mensaje: 'Límite de emisión de comprobantes alcanzado temporalmente. Intenta en unos minutos.',
});

module.exports = {
  crearLimiter,
  createRateLimiter,
  apiLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  uploadLimiter,
  aiLimiter,
  emisionLimiter,
};
