const express = require('express');
const router = express.Router();
const { webhookOnvo } = require('../controllers/onvoController');

/**
 * Router de webhook ONVO.
 * Se monta en server.js ANTES de express.json() global, por eso conserva
 * el cuerpo crudo aquí. Los endpoints nuevos de ONVO firman ese cuerpo con
 * X-Onvo-Signature; el formato legacy usa X-Webhook-Secret.
 */
router.post('/', express.raw({ type: 'application/json', limit: '256kb' }), webhookOnvo);

module.exports = router;
