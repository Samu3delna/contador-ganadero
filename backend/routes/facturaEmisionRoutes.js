const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const { puedeFacturar } = require('../middleware/haciendaGuard');
const {
  obtenerFacturasEmision,
  obtenerFacturaEmision,
  crearFacturaEmision,
  actualizarEstadoFactura,
  anularFactura,
  obtenerResumenEmision,
} = require('../controllers/facturaEmisionController');

router.use(protegerRuta);
router.use(extraerTenant);
router.use(require('../middleware/rbacMiddleware').permitir('facturas:leer'));

router.get('/', obtenerFacturasEmision);
router.get('/resumen', obtenerResumenEmision);
router.post('/', puedeFacturar, crearFacturaEmision);
router.get('/:id', obtenerFacturaEmision);
router.put('/:id/estado', puedeFacturar, actualizarEstadoFactura);
router.put('/:id/anular', puedeFacturar, anularFactura);

module.exports = router;
