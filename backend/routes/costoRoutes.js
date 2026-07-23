const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const {
  obtenerCostos,
  crearCentroCosto,
  agregarConsumo,
  agregarProduccion,
  cerrarCentroCosto,
  obtenerResumenCostos,
} = require('../controllers/costoController');

router.use(protegerRuta);
router.use(extraerTenant);

router.get('/', obtenerCostos);
router.get('/resumen', obtenerResumenCostos);
router.post('/centros', crearCentroCosto);
router.post('/centros/:referenciaId/consumo', agregarConsumo);
router.post('/centros/:referenciaId/produccion', agregarProduccion);
router.put('/centros/:referenciaId/cerrar', cerrarCentroCosto);

module.exports = router;
