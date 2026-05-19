const express = require('express');
const router = express.Router();
const {
  obtenerConfiguracionFiscal,
  actualizarConfiguracionFiscal,
  obtenerResumenDeclaracion,
  exportarDatos,
  obtenerGastosDeducibles,
  obtenerIngresosDeclaracion,
} = require('../controllers/declaracionController');
const { protegerRuta } = require('../middleware/authMiddleware');

router.use(protegerRuta);

router.get('/configuracion', obtenerConfiguracionFiscal);
router.put('/configuracion', actualizarConfiguracionFiscal);

router.get('/resumen', obtenerResumenDeclaracion);
router.get('/gastos', obtenerGastosDeducibles);
router.get('/ingresos', obtenerIngresosDeclaracion);
router.get('/exportar', exportarDatos);

module.exports = router;
