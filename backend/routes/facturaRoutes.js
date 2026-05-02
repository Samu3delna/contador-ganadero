const express = require('express');
const router = express.Router();
const {
  obtenerFacturas, obtenerFacturaPorId, actualizarCategoriaFactura,
  eliminarFactura, estadoEmail, forzarSincronizacion, crearGastoManual
} = require('../controllers/facturaController');
const { protegerRuta } = require('../middleware/authMiddleware');

router.use(protegerRuta);
router.route('/').get(obtenerFacturas);
router.post('/manual', crearGastoManual);
router.route('/:id').get(obtenerFacturaPorId).delete(eliminarFactura);
router.put('/:id/categoria', actualizarCategoriaFactura);
router.get('/email/estado', estadoEmail);
router.post('/email/sincronizar', forzarSincronizacion);

module.exports = router;
