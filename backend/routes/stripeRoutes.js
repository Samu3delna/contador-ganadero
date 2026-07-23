const express = require('express');
const router = express.Router();
const {
  crearSesionCheckout,
  crearPortalCliente,
  obtenerEstadoSuscripcion,
} = require('../controllers/stripeController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const { esDueñoTenant } = require('../middleware/adminGuard');

/**
 * Rutas autenticadas (usan express.json() aplicado en server.js globalmente)
 */
router.post('/checkout', protegerRuta, extraerTenant, esDueñoTenant, crearSesionCheckout);
router.post('/portal', protegerRuta, extraerTenant, esDueñoTenant, crearPortalCliente);
router.get('/estado', protegerRuta, extraerTenant, obtenerEstadoSuscripcion);

module.exports = router;
