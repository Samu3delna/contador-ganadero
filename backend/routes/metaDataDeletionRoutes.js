const express = require('express');
const router = express.Router();
const {
  handleMetaDataDeletionCallback,
  infoMetaDataDeletionWebhook,
  obtenerEstadoEliminacion,
  crearSolicitudEliminacionPublica,
} = require('../controllers/dataDeletionController');

router.get('/', infoMetaDataDeletionWebhook);
router.post('/', handleMetaDataDeletionCallback);
router.get('/status/:code', obtenerEstadoEliminacion);
router.post('/solicitud', crearSolicitudEliminacionPublica);

module.exports = router;
