const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
const {
  obtenerFacturasEmision,
  obtenerFacturaEmision,
  crearFacturaEmision,
  actualizarEstadoFactura,
  anularFactura,
  obtenerResumenEmision,
} = require('../controllers/facturaEmisionController');

router.use(protegerRuta);

router.get('/', obtenerFacturasEmision);
router.get('/resumen', obtenerResumenEmision);
router.post('/', crearFacturaEmision);
router.get('/:id', obtenerFacturaEmision);
router.put('/:id/estado', actualizarEstadoFactura);
router.put('/:id/anular', anularFactura);

module.exports = router;
