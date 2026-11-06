const express = require('express');
const router = express.Router();
const {
  crearSesionCheckout,
  cancelarSuscripcionTenant,
  obtenerEstadoSuscripcion,
  obtenerPlanes,
} = require('../controllers/onvoController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenantFacturacion } = require('../middleware/tenantGuard');
const { esDueñoTenant } = require('../middleware/adminGuard');

/**
 * Rutas autenticadas (usan express.json() aplicado en server.js globalmente).
 * Usan extraerTenantFacturacion para permitir a fincas suspendidas o canceladas
 * consultar su estado, pagar para reactivar su suscripción o volver al plan Gratis.
 */
router.post('/checkout', protegerRuta, extraerTenantFacturacion, esDueñoTenant, crearSesionCheckout);
router.post('/cancelar', protegerRuta, extraerTenantFacturacion, esDueñoTenant, cancelarSuscripcionTenant);
router.get('/estado', protegerRuta, extraerTenantFacturacion, obtenerEstadoSuscripcion);

/**
 * Catálogo público de planes (precios y features), sin autenticación.
 */
router.get('/planes', obtenerPlanes);

module.exports = router;
