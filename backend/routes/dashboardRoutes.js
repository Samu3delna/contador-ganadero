const express = require('express');
const router = express.Router();
const { resumen, gastosPorCategoria, tendenciaMensual } = require('../controllers/dashboardController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');

router.use(protegerRuta);
router.use(extraerTenant);
router.get('/resumen', resumen);
router.get('/gastos-por-categoria', gastosPorCategoria);
router.get('/tendencia-mensual', tendenciaMensual);

module.exports = router;
