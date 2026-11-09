const router = require('express').Router();
const { authLimiter } = require('../middleware/rateLimiters');
const allowed = new Set(['/registro', '/login', '/mfa/verify', '/refresh', '/logout']);
router.use(authLimiter, (req, res, next) => {
  if (req.method !== 'POST' || !allowed.has(req.path)) return res.status(404).json({ error: 'API no encontrada' });
  res.locals.mobileAuth = true;
  res.set('Cache-Control', 'no-store');
  if (req.path === '/mfa/verify') {
    const body = req.body || {};
    if (typeof body.mfaToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.mfaToken) ||
      Object.keys(body).some(k => !['mfaToken', 'totpCode', 'backupCode'].includes(k)) ||
      (body.totpCode !== undefined && (typeof body.totpCode !== 'string' || !/^\d{6}$/.test(body.totpCode))) ||
      (body.backupCode !== undefined && (typeof body.backupCode !== 'string' || body.backupCode.length > 24)) ||
      (!body.totpCode && !body.backupCode)) return res.status(400).json({ error: 'Datos de verificación MFA inválidos' });
  }
  if (['/refresh', '/logout'].includes(req.path)) {
    const token = req.body?.refreshToken;
    if (typeof token !== 'string' || token.length < 16 || token.length > 4096 || Object.keys(req.body).some(k => k !== 'refreshToken')) {
      return res.status(400).json({ error: 'Refresh token requerido o formato inválido' });
    }
  }
  next();
});
// Same validation, rate limits, password/MFA policy and session rotation as web.
router.use(require('./authRoutes'));
module.exports = router;
