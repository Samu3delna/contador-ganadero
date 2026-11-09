const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadLimiter } = require('../middleware/rateLimiters');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB máx por XML
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const esXml =
      name.endsWith('.xml') && (
      mime === 'application/octet-stream' ||
      mime === 'application/xml' ||
      mime === 'text/xml' ||
      mime.endsWith('+xml'));
    if (!esXml) {
      const error = new Error('Solo se permiten archivos XML (.xml)');
      error.statusCode = 415;
      return cb(error);
    }
    cb(null, true);
  },
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
const { permitir } = require('../middleware/rbacMiddleware');
router.use((req, res, next) => {
 const accion = req.method === 'DELETE' ? 'facturas:eliminar' : req.method === 'GET' ? 'facturas:leer' : req.path === '/upload' ? 'facturas:subir_xml' : req.path === '/manual' ? 'facturas:crear_manual' : 'facturas:editar_deducibilidad';
 return permitir(accion)(req,res,next);
});
router.route('/').get(obtenerFacturas);
router.get('/resumen', require('../controllers/facturaController').resumenGastos);
router.post('/manual', crearGastoManual);
router.post('/upload', uploadLimiter, upload.single('archivoXML'), subirXMLManual);

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
