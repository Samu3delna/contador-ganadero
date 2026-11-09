const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Challenge = require('../models/MfaChallenge');
const { verifyTotpToken, hashBackupCode } = require('../utils/totp');

const hash = token => crypto.createHash('sha256').update(String(token)).digest('hex');
async function crearDesafio(usuario) {
  const token = crypto.randomBytes(32).toString('hex');
  await Challenge.create({ tokenHash: hash(token), usuarioId: usuario._id,
    tokenVersion: usuario.tokenVersion || 0, expiresAt: new Date(Date.now() + 300000) });
  return token;
}
async function verificarFactor(usuario, { totpCode, backupCode } = {}) {
  if (totpCode) return Boolean(usuario.getMfaSecret() && verifyTotpToken(usuario.getMfaSecret(), totpCode));
  if (!backupCode) return false;
  const codeHash = hashBackupCode(backupCode);
  const result = await Usuario.updateOne({ _id: usuario._id, 'mfa.enabled': true, 'mfa.backupCodesHash': codeHash },
    { $pull: { 'mfa.backupCodesHash': codeHash } });
  return result.modifiedCount === 1;
}
function opcionesCookieMfa() {
  const prod = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: prod, sameSite: prod ? 'none' : 'lax', path: '/api/auth/mfa', maxAge: 300000 };
}
async function verificarDesafio(req, res, next) {
  try {
    const token = req.body?.mfaToken || req.cookies?.mfaChallenge;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Desafío MFA inválido' });
    const challenge = await Challenge.findOne({ tokenHash: hash(token), usedAt: null, expiresAt: { $gt: new Date() } });
    if (!challenge) return res.status(401).json({ error: 'Desafío MFA vencido o utilizado' });
    const usuario = await Usuario.findById(challenge.usuarioId).select('+mfa.secretEncrypted');
    if (!usuario || usuario.suspendido || !usuario.mfa?.enabled || (usuario.tokenVersion || 0) !== challenge.tokenVersion || usuario.estaBloqueado()) {
      return res.status(401).json({ error: 'Sesión MFA inválida' });
    }
    if (!await verificarFactor(usuario, req.body)) {
      await usuario.registrarIntentoFallido();
      return res.status(401).json({ error: 'Código MFA inválido' });
    }
    const claimed = await Challenge.findOneAndUpdate({ _id: challenge._id, usedAt: null }, { $set: { usedAt: new Date() } });
    if (!claimed) return res.status(401).json({ error: 'Desafío MFA utilizado' });
    const Tenant = require('../models/Tenant');
    await Tenant.actualizarCiclo(usuario.tenantId);
    const tenant = await Tenant.findById(usuario.tenantId);
    if (!tenant?.estaActivo()) return res.status(403).json({ error: 'Finca inactiva' });
    const { emitirRefreshToken, setRefreshCookie, generarToken } = require('../controllers/authController');
    const verifiedAt = Date.now();
    const refresh = await emitirRefreshToken(usuario, tenant._id, req, null, verifiedAt);
    setRefreshCookie(res, refresh.token);
    const { maxAge, ...cookieOptions } = opcionesCookieMfa();
    if (!res.locals?.mobileAuth) res.clearCookie('mfaChallenge', cookieOptions);
    await usuario.resetearIntentosLogin();
    require('./authTransport').sendSession(res, { _id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol,
      cedula: usuario.cedula, telefono: usuario.telefono, nombreFinca: usuario.nombreFinca,
      tenantId: tenant._id, tenant: tenant.toJSON(), plan: tenant.plan, esSuperAdmin: usuario.isSuperAdmin,
      token: generarToken(usuario, tenant._id, verifiedAt) });
  } catch (error) { next(error); }
}
module.exports = { crearDesafio, verificarFactor, verificarDesafio, opcionesCookieMfa };
