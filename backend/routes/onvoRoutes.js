const express = require('express');
const router = express.Router();
const {
  crearSesionCheckout,
  cancelarSuscripcionTenant,
  obtenerEstadoSuscripcion,
  obtenerPlanes,
} = require('../controllers/onvoController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const { esDueñoTenant } = require('../middleware/adminGuard');

/**
 * Rutas autenticadas (usan express.json() aplicado en server.js globalmente)
 */
router.post('/checkout', protegerRuta, extraerTenant, esDueñoTenant, crearSesionCheckout);
router.post('/cancelar', protegerRuta, extraerTenant, esDueñoTenant, cancelarSuscripcionTenant);
router.get('/estado', protegerRuta, extraerTenant, obtenerEstadoSuscripcion);

/**
 * Catálogo público de planes (precios y features), sin autenticación.
 */
router.get('/planes', obtenerPlanes);

module.exports = router;
