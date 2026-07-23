const express = require('express');
const router = express.Router();
const {
  obtenerConfiguracionFiscal,
  actualizarConfiguracionFiscal,
  obtenerResumenDeclaracion,
  generarDeclaracion,
  listarDeclaraciones,
  obtenerDeclaracion,
  actualizarEstadoDeclaracion,
  eliminarDeclaracion,
  exportarDatos,
  obtenerGastosDeducibles,
  obtenerIngresosDeclaracion,
} = require('../controllers/declaracionController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');

router.use(protegerRuta);
router.use(extraerTenant);

router.get('/configuracion', obtenerConfiguracionFiscal);
router.put('/configuracion', actualizarConfiguracionFiscal);

router.get('/resumen', obtenerResumenDeclaracion);
router.get('/gastos', obtenerGastosDeducibles);
router.get('/ingresos', obtenerIngresosDeclaracion);
router.get('/exportar', exportarDatos);

// CRUD de declaraciones guardadas
router.route('/')
  .get(listarDeclaraciones)
  .post(generarDeclaracion);

router.route('/:id')
  .get(obtenerDeclaracion)
  .delete(eliminarDeclaracion);

router.put('/:id/estado', actualizarEstadoDeclaracion);

module.exports = router;
