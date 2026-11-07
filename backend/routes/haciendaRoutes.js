const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const { puedeFacturar } = require('../middleware/haciendaGuard');
const {
  infoAmbiente,
  crearBorrador,
  firmarDocumento,
  enviarAHacienda,
  obtenerXml,
  consultarEstado,
  cancelarDocumento,
  consultaMockLocal,
} = require('../controllers/haciendaController');
const { obtenerFacturasEmision } = require('../controllers/facturaEmisionController');

// Endpoint interno de consulta para ambiente local (lo usa el mock de recepcion.js)
router.get('/interno/consulta/:clave', consultaMockLocal);

router.use(['/fec', '/rep', '/d150'], (_req, res) => res.status(404).json({ error: 'API no encontrada' }));

router.use(protegerRuta);
router.use(extraerTenant);
router.use(['/emision', '/ambiente'], require('../middleware/rbacMiddleware').permitir('facturas:leer'));

// Signing or changing fiscal documents requires a financial role in this finca.
router.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  return puedeFacturar(req, res, next);
});

// Info del ambiente Hacienda
router.get('/ambiente', infoAmbiente);

// Listar y crear comprobantes de emision
router.get('/emision', obtenerFacturasEmision);
router.post('/emision', crearBorrador);

// Firmar documento (genera XML v4.4 + firma XAdES)
router.post('/emision/:id/firmar', firmarDocumento);

// Encolar envio a Hacienda (worker asincrono lo procesa)
router.post('/emision/:id/enviar', enviarAHacienda);

// Cancelar/Anular (genera NC)
router.post('/emision/:id/cancelar', cancelarDocumento);

// Descargar XML firmado
router.get('/emision/:id/xml', obtenerXml);

// Consultar estado sincronico contra Hacienda (o mock local)
router.get('/emision/:id/estado', consultarEstado);

module.exports = router;
