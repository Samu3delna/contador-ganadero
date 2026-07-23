const express = require('express');
const router = express.Router();
const { webhookStripe } = require('../controllers/stripeController');

/**
 * Router de webhook Stripe.
 * Se monta en server.js ANTES de express.json() para que reciba raw body.
 * Express.raw middleware parsea el body a Buffer nativo.
 */
router.post('/', express.raw({ type: 'application/json' }), webhookStripe);

module.exports = router;
