const express = require('express');
const router = express.Router();
const { enviarContactoSoporte } = require('../controllers/supportController');
const { apiLimiter } = require('../middleware/rateLimiters');

/**
 * POST /api/support/contact
 * Formulario de contacto público para soporte
 * Rate limited para evitar abuso
 */
router.post(
  '/contact',
  apiLimiter,
  express.json({ limit: '100kb' }),
  enviarContactoSoporte
);

module.exports = router;