const express = require('express');
const rateLimit = require('express-rate-limit');
const { protegerRuta } = require('../middleware/authMiddleware');
const { chat, chatStream, enviarFeedback } = require('../controllers/chatController');

const router = express.Router();

// Rate limiter per-user para chat normal
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,
  keyGenerator: (req) => req.usuario?._id?.toString() || req.ip,
  message: {
    error: 'Límite de tasa excedido',
    respuesta: 'Demasiadas consultas al chat. Espera un minuto e intenta de nuevo.',
  },
  standardHeaders: true,  // Envía X-RateLimit-* headers
  legacyHeaders: false,
  // Permitir burst: skip si el usuario no ha excedido el burst limit
  skipSuccessfulRequests: false,
});

// Rate limiter para streaming (más permisivo en window, mismo max)
const streamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => req.usuario?._id?.toString() || req.ip,
  message: {
    error: 'Límite de tasa excedido',
    respuesta: 'Demasiadas consultas de streaming. Espera un momento.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para feedback (más generoso)
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.usuario?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rutas
router.post('/', protegerRuta, chatLimiter, chat);
router.post('/stream', protegerRuta, streamLimiter, chatStream);
router.post('/feedback', protegerRuta, feedbackLimiter, enviarFeedback);

module.exports = router;