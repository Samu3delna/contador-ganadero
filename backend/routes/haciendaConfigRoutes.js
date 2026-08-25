const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const {
  obtenerConfig,
  guardarConfig,
  probarConexion,
  eliminarConfig,
} = require('../controllers/haciendaConfigController');

router.use(protegerRuta);
router.use(extraerTenant);

// GET /api/hacienda/config - Obtener estado de configuración
router.get('/config', obtenerConfig);

// POST /api/hacienda/config - Guardar/actualizar configuración
router.post('/config', guardarConfig);

// POST /api/hacienda/config/test - Probar conexión y firma
router.post('/config/test', probarConexion);

// DELETE /api/hacienda/config - Eliminar configuración
router.delete('/config', eliminarConfig);

module.exports = router;