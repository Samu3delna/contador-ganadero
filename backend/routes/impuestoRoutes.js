const express = require('express');
const router = express.Router();
const { calcularIVA, calcularRenta, proyeccion } = require('../controllers/impuestoController');
const { protegerRuta } = require('../middleware/authMiddleware');

router.use(protegerRuta);
router.get('/iva/:cuatrimestre/:anio', calcularIVA);
router.get('/renta/:anio', calcularRenta);
router.get('/proyeccion', proyeccion);

module.exports = router;
