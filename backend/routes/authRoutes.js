const express = require('express');
const router = express.Router();
const {
  registro,
  login,
  refrescarToken,
  logout,
  logoutAll,
  listarSesiones,
  revocarSesion,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  mfaSetup,
  mfaEnable,
  mfaDisable,
  exportarMisDatos,
} = require('../controllers/authController');
const { googleLogin: googleLoginCtrl, googleCallback: googleCallbackCtrl } = require('../controllers/googleAuthController');
const { eliminarMiCuentaAutenticada } = require('../controllers/dataDeletionController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const { loginLimiter, registerLimiter, passwordResetLimiter } = require('../middleware/rateLimiters');
const { z, validar } = require('../middleware/validateMiddleware');

// Esquemas de validación estricta (rechazan operadores NoSQL y campos desconocidos)
const loginSchema = {
  body: z.object({
    email: z.string().email().max(150),
    password: z.string().min(1).max(200),
    totpCode: z.string().max(12).optional(),
    backupCode: z.string().max(24).optional(),
  }).strict(),
};

const registroSchema = {
  body: z.object({
    nombre: z.string().min(1).max(100),
    email: z.string().email().max(150),
    password: z.string().min(1).max(200),
    cedula: z.any().optional(),
    nombreFinca: z.string().max(120).optional(),
    cantidadHijos: z.number().min(0).max(20).optional(),
    tieneConyuge: z.boolean().optional(),
    telefono: z.string().max(30).optional(),
    aceptaTerminos: z.boolean().optional(),
    versionTerminos: z.string().max(32).optional(),
    rol: z.any().optional(),
    tenantId: z.any().optional(),
    plan: z.any().optional(),
    isSuperAdmin: z.any().optional(),
  }).strict(),
};

const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email().max(150),
  }).strict(),
};

const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(16).max(256),
    passwordNueva: z.string().min(8).max(200),
  }).strict(),
};

// Rutas públicas de autenticación con rate limiters dedicados
router.post('/registro', registerLimiter, validar(registroSchema), registro);
router.post('/login', loginLimiter, validar(loginSchema), login);
router.post('/forgot-password', passwordResetLimiter, validar(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validar(resetPasswordSchema), resetPassword);
router.post('/verify-email', passwordResetLimiter, verifyEmail);
router.get('/google', googleLoginCtrl);
router.get('/google/callback', googleCallbackCtrl);
router.post('/refresh', refrescarToken);
router.post('/logout', logout);

// Rutas autenticadas
router.post('/logout-all', protegerRuta, logoutAll);
router.get('/sesiones', protegerRuta, listarSesiones);
router.delete('/sesiones/:id', protegerRuta, revocarSesion);
router.get('/perfil', protegerRuta, extraerTenant, obtenerPerfil);
router.put('/perfil', protegerRuta, extraerTenant, actualizarPerfil);
router.put('/cambiar-password', protegerRuta, cambiarPassword);
router.post('/mfa/setup', protegerRuta, mfaSetup);
router.post('/mfa/enable', protegerRuta, mfaEnable);
router.post('/mfa/disable', protegerRuta, mfaDisable);
router.get('/exportar-datos', protegerRuta, extraerTenant, exportarMisDatos);
router.delete('/eliminar-cuenta', protegerRuta, eliminarMiCuentaAutenticada);

module.exports = router;
