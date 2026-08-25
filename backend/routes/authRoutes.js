const express = require('express');
const router = express.Router();
const {
  registro,
  login,
  refrescarToken,
  logout,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  googleLogin,
  googleCallback,
} = require('../controllers/authController');
const { googleLogin: googleLoginCtrl, googleCallback: googleCallbackCtrl } = require('../controllers/googleAuthController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');

router.post('/registro', registro);
router.post('/login', login);
router.get('/google', googleLoginCtrl);
router.get('/google/callback', googleCallbackCtrl);
router.post('/refresh', refrescarToken);
router.post('/logout', logout);
router.get('/perfil', protegerRuta, extraerTenant, obtenerPerfil);
router.put('/perfil', protegerRuta, extraerTenant, actualizarPerfil);
router.put('/cambiar-password', protegerRuta, cambiarPassword);

module.exports = router;
