const express = require('express');
const router = express.Router();
const { webhookOnvo } = require('../controllers/onvoController');

/**
 * Router de webhook ONVO.
 * Se monta en server.js ANTES de express.json() global, por eso parsea
 * el JSON aquí. A diferencia de Stripe, ONVO no firma el body crudo:
 * autentica con el header X-Webhook-Secret, así que no hace falta raw body.
 */
router.post('/', express.json({ limit: '256kb' }), webhookOnvo);

module.exports = router;
