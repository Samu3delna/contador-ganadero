const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middleware/authMiddleware');
const { extraerTenant } = require('../middleware/tenantGuard');
const {
  obtenerInventario,
  agregarBovino,
  actualizarBovino,
  eliminarBovino,
  agregarLoteAves,
  actualizarLoteAves,
  eliminarLoteAves,
  agregarEstanque,
  actualizarEstanque,
  eliminarEstanque,
  agregarColmena,
  actualizarColmena,
  eliminarColmena,
  obtenerResumenInventario,
} = require('../controllers/inventarioController');

router.use(protegerRuta);
router.use(extraerTenant);

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
router.delete('/aves/:id', eliminarLoteAves);

// Peces
router.post('/peces', agregarEstanque);
router.put('/peces/:id', actualizarEstanque);
router.delete('/peces/:id', eliminarEstanque);

// Colmenas
router.post('/colmenas', agregarColmena);
router.put('/colmenas/:id', actualizarColmena);
router.delete('/colmenas/:id', eliminarColmena);

module.exports = router;
