const express = require('express');
const router = express.Router();
const { calcularIVA, calcularRenta, proyeccion } = require('../controllers/impuestoController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');

router.use(protegerRuta);
router.use(extraerTenant);
router.get('/iva/:cuatrimestre/:anio', calcularIVA);
router.get('/renta/:anio', calcularRenta);
router.get('/proyeccion', proyeccion);

module.exports = router;
