const express = require('express');
const router = express.Router();
const {
  obtenerFacturas, obtenerFacturaPorId, actualizarCategoriaFactura,
  eliminarFactura, estadoEmail, forzarSincronizacion, crearGastoManual,
  descargarXML, descargarPDF, obtenerAlertasTarifa
} = require('../controllers/facturaController');
const { protegerRuta } = require('../middleware/authMiddleware');

router.use(protegerRuta);
router.route('/').get(obtenerFacturas);
router.post('/manual', crearGastoManual);

// Alertas de tarifa agropecuaria
router.get('/alertas-tarifa', obtenerAlertasTarifa);

// Email
router.get('/email/estado', estadoEmail);
router.post('/email/sincronizar', forzarSincronizacion);

// Descarga de archivos
router.get('/:id/xml', descargarXML);
router.get('/:id/pdf', descargarPDF);

router.route('/:id').get(obtenerFacturaPorId).delete(eliminarFactura);
router.put('/:id/categoria', actualizarCategoriaFactura);

module.exports = router;
