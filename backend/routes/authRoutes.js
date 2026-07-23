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
} = require('../controllers/authController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');

router.post('/registro', registro);
router.post('/login', login);
router.post('/refresh', refrescarToken);
router.post('/logout', logout);
router.get('/perfil', protegerRuta, extraerTenant, obtenerPerfil);
router.put('/perfil', protegerRuta, extraerTenant, actualizarPerfil);
router.put('/cambiar-password', protegerRuta, cambiarPassword);

module.exports = router;
