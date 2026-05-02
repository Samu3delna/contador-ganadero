const express = require('express');
const router = express.Router();
const { registro, login, obtenerPerfil, actualizarPerfil } = require('../controllers/authController');
const { protegerRuta } = require('../middleware/authMiddleware');

router.post('/registro', registro);
router.post('/login', login);
router.get('/perfil', protegerRuta, obtenerPerfil);
router.put('/perfil', protegerRuta, actualizarPerfil);

module.exports = router;
