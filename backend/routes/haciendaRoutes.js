const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
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
const repController = require('../controllers/repController');
const fecController = require('../controllers/fecController');
const d150Controller = require('../controllers/d150Controller');

router.use(protegerRuta);

//_info del ambiente Hacienda
router.get('/ambiente', infoAmbiente);

//Crear borrador de FE/TE/NC/ND/FEC/REP (con CABYS de 13 digitos)
router.post('/emision', crearBorrador);

//Firmar documento (genera XML v4.4 + firma XAdES)
router.post('/emision/:id/firmar', firmarDocumento);

//Encolar envio a Hacienda (worker asincrono lo procesa)
router.post('/emision/:id/enviar', enviarAHacienda);

//Cancelar/Anular (genera NC en futuro)
router.post('/emision/:id/cancelar', cancelarDocumento);

//Descargar XML firmado
router.get('/emision/:id/xml', obtenerXml);

//Consultar estado sincronico contra Hacienda (o mock local)
router.get('/emision/:id/estado', consultarEstado);

// ============ REP (Recibo Electronico de Pago) ============
router.post('/rep', repController.crearRep);
router.get('/rep', repController.listarRep);
router.get('/rep/por-factura/:facturaIdOriginal', repController.resumenAbonosPorFactura);

// ============ FEC (Factura Electronica de Compra) ============
router.post('/fec', fecController.crearFec);
router.get('/fec', fecController.listarFec);
router.get('/fec/resumen', fecController.resumenCompras);

// ============ D-150 Conciliacion Tributaria ============
router.get('/d150/conciliacion', d150Controller.conciliacion);
router.post('/d150/conciliacion', d150Controller.conciliacion);
router.get('/d150/reporte/pdf', d150Controller.reportePDF);
router.get('/d150/reporte/excel', d150Controller.reporteExcel);

//Endpoint interno de consulta para ambiente local (lo usa el mock de recepcion.js)
router.get('/interno/consulta/:clave', consultaMockLocal);

module.exports = router;
