const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const {
  obtenerFacturasEmision,
  obtenerFacturaEmision,
  obtenerResumenEmision,
} = require('../controllers/facturaEmisionController');

router.post('/', (_req, res) => res.status(404).json({ error: 'API no encontrada' }));
router.put('/:id/estado', (_req, res) => res.status(404).json({ error: 'API no encontrada' }));

router.use(protegerRuta);
router.use(extraerTenant);
router.use(require('../middleware/rbacMiddleware').permitir('facturas:leer'));

router.get('/', obtenerFacturasEmision);
router.get('/resumen', obtenerResumenEmision);
router.get('/:id', obtenerFacturaEmision);

module.exports = router;
