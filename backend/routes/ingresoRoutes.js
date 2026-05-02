const express = require('express');
const router = express.Router();
const { obtenerIngresos, obtenerIngresoPorId, crearIngreso, actualizarIngreso, eliminarIngreso } = require('../controllers/ingresoController');
const { protegerRuta } = require('../middleware/authMiddleware');

router.use(protegerRuta);
router.route('/').get(obtenerIngresos).post(crearIngreso);
router.route('/:id').get(obtenerIngresoPorId).put(actualizarIngreso).delete(eliminarIngreso);

module.exports = router;
