const express = require('express');
const router = express.Router();
const { obtenerIngresos, obtenerIngresoPorId, crearIngreso, actualizarIngreso, eliminarIngreso } = require('../controllers/ingresoController');
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');

router.use(protegerRuta);
router.use(extraerTenant);
router.use((req,res,next) => require('../middleware/rbacMiddleware').permitir(req.method === 'GET' ? 'ingresos:leer' : req.method === 'DELETE' ? 'ingresos:eliminar' : 'ingresos:crear')(req,res,next));
router.route('/').get(obtenerIngresos).post(crearIngreso);
router.route('/:id').get(obtenerIngresoPorId).put(actualizarIngreso).delete(eliminarIngreso);

module.exports = router;
