const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
const {
  obtenerInventario,
  agregarBovino,
  actualizarBovino,
  eliminarBovino,
  agregarLoteAves,
  actualizarLoteAves,
  agregarEstanque,
  actualizarEstanque,
  agregarColmena,
  actualizarColmena,
  obtenerResumenInventario,
} = require('../controllers/inventarioController');

router.use(protegerRuta);

// Inventario general
router.get('/', obtenerInventario);
router.get('/resumen', obtenerResumenInventario);

// Bovinos
router.post('/bovinos', agregarBovino);
router.put('/bovinos/:id', actualizarBovino);
router.delete('/bovinos/:id', eliminarBovino);

// Aves
router.post('/aves', agregarLoteAves);
router.put('/aves/:id', actualizarLoteAves);

// Peces
router.post('/peces', agregarEstanque);
router.put('/peces/:id', actualizarEstanque);

// Colmenas
router.post('/colmenas', agregarColmena);
router.put('/colmenas/:id', actualizarColmena);

module.exports = router;
