const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const {
  obtenerFacturas, obtenerFacturaPorId, actualizarCategoriaFactura, actualizarDeducibilidad,
  eliminarFactura, estadoEmail, forzarSincronizacion, crearGastoManual,
  descargarXML, descargarPDF, obtenerAlertasTarifa, diagnosticarIMAP, subirXMLManual
} = require('../controllers/facturaController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');

router.use(protegerRuta);
router.use(extraerTenant);
router.route('/').get(obtenerFacturas);
router.post('/manual', crearGastoManual);
router.post('/upload', upload.single('archivoXML'), subirXMLManual);

// Alertas de tarifa agropecuaria
router.get('/alertas-tarifa', obtenerAlertasTarifa);

// Email
router.get('/email/estado', estadoEmail);
router.post('/email/sincronizar', forzarSincronizacion);
router.post('/email/diagnostico', diagnosticarIMAP);

// Descarga de archivos
router.get('/:id/xml', descargarXML);
router.get('/:id/pdf', descargarPDF);

router.route('/:id').get(obtenerFacturaPorId).delete(eliminarFactura);
router.put('/:id/categoria', actualizarCategoriaFactura);
router.put('/:id/deducibilidad', actualizarDeducibilidad);

module.exports = router;
