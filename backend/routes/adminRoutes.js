const express = require('express');
const router = express.Router();

const { protegerRuta } = require('../middleware/authMiddleware');
const { esSuperAdmin } = require('../middleware/adminGuard');
const {
  obtenerResumen,
  listarUsuarios,
  obtenerUsuario,
  actualizarUsuario,
  cambiarSuspensionUsuario,
  resetPasswordUsuario,
  eliminarUsuario,
  listarTenants,
  obtenerTenant,
  cambiarPlanTenant,
  cambiarEstadoTenant,
  resetearConsumoTenant,
  monitoreoEventosOnvo,
  monitoreoChatFeedback,
  monitoreoEmail,
  monitoreoSalud,
} = require('../controllers/adminController');

// Todas las rutas de admin requieren autenticación + super admin
router.use(protegerRuta, esSuperAdmin);

// === Métricas globales ===
router.get('/resumen', obtenerResumen);

// === Gestión de usuarios ===
router.get('/usuarios', listarUsuarios);
router.get('/usuarios/:id', obtenerUsuario);
router.put('/usuarios/:id', actualizarUsuario);
router.put('/usuarios/:id/suspension', cambiarSuspensionUsuario);
router.put('/usuarios/:id/reset-password', resetPasswordUsuario);
router.delete('/usuarios/:id', eliminarUsuario);

// === Gestión de tenants y planes ===
router.get('/tenants', listarTenants);
router.get('/tenants/:id', obtenerTenant);
router.put('/tenants/:id/plan', cambiarPlanTenant);
router.put('/tenants/:id/estado', cambiarEstadoTenant);
router.post('/tenants/:id/resetear-consumo', resetearConsumoTenant);

// === Monitoreo operativo ===
router.get('/monitoreo/eventos-onvo', monitoreoEventosOnvo);
router.get('/monitoreo/chat-feedback', monitoreoChatFeedback);
router.get('/monitoreo/email', monitoreoEmail);
router.get('/monitoreo/salud', monitoreoSalud);

module.exports = router;
