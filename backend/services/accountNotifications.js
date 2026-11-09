const crypto = require('crypto');
const Notification = require('../models/AccountNotification');
const Usuario = require('../models/Usuario');
const { encryptSecret, decryptSecret, isConfigured } = require('../utils/crypto');
function contexto(doc) { return { tenantId: String(doc.tenantId || doc.usuarioId), fieldName: `accountNotification:${doc._id}` }; }
async function encolar(usuario, raw, tipo) {
  if (!isConfigured()) throw new Error('Cifrado de notificaciones no configurado');
  const doc = new Notification({ usuarioId: usuario._id, tenantId: usuario.tenantId, tipo,
    tokenHash: crypto.createHash('sha256').update(raw).digest('hex'),
    expiresAt: tipo === 'reset' ? usuario.resetPasswordExpires : usuario.emailVerificationExpires });
  doc.tokenEncrypted = encryptSecret(raw, contexto(doc));
  await doc.save();
  return doc._id;
}
async function tick({ enviar } = {}) {
  // Habilitar con las credenciales existentes; conservar el apagado explícito.
  if (!enviar && (process.env.ACCOUNT_EMAIL_DELIVERY_ENABLED === 'false' ||
    !process.env.CLOUDFLARE_EMAIL_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) return;
  const send = enviar || require('../controllers/supportController').enviarEmailCloudflare;
  const pendientes = await Notification.find({ estado: 'pendiente', $or: [{ claimHasta: null }, { claimHasta: { $lte: new Date() } }] }).limit(20);
  for (const pending of pendientes) {
    const token = crypto.randomUUID();
    const doc = await Notification.findOneAndUpdate({ _id: pending._id, estado: 'pendiente',
      $or: [{ claimHasta: null }, { claimHasta: { $lte: new Date() } }] },
    { $set: { claimToken: token, claimHasta: new Date(Date.now() + 60000) }, $inc: { intentos: 1 } }, { new: true }).select('+tokenEncrypted');
    if (!doc) continue;
    try {
      const user = await Usuario.findById(doc.usuarioId).select('+resetPasswordTokenHash +emailVerificationTokenHash');
      const hash = doc.tipo === 'reset' ? user?.resetPasswordTokenHash : user?.emailVerificationTokenHash;
      if (!user || user.suspendido || doc.expiresAt <= new Date() || hash !== doc.tokenHash) {
        await Notification.updateOne({ _id: doc._id, claimToken: token }, { $set: { estado: 'vencida' }, $unset: { tokenEncrypted: 1, claimToken: 1, claimHasta: 1 } }); continue;
      }
      const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
      const raw = decryptSecret(doc.tokenEncrypted, contexto(doc));
      const link = `${base}/${doc.tipo === 'reset' ? 'restablecer-password' : 'verificar-email'}#token=${encodeURIComponent(raw)}`;
      const text = `ContadorGanadero: ${doc.tipo === 'reset' ? 'restablecer contraseña' : 'verificar correo'}. Abra el enlace de un solo uso antes de su vencimiento: ${link}`;
      const result = await send({ to: [user.email], subject: doc.tipo === 'reset' ? 'Restablecer contraseña' : 'Verificar correo', text,
        html: `<p>${doc.tipo === 'reset' ? 'Restablecer contraseña' : 'Verificar correo'}</p><p><a href="${link.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">Continuar en ContadorGanadero</a></p>` });
      if (!result.success) throw new Error('Entrega pendiente');
      await Notification.updateOne({ _id: doc._id, claimToken: token }, { $set: { estado: 'enviada' }, $unset: { tokenEncrypted: 1, claimToken: 1, claimHasta: 1 } });
    } catch {
      await Notification.updateOne({ _id: doc._id, claimToken: token }, { $set: { claimHasta: new Date(Date.now() + 60000) }, $unset: { claimToken: 1 } });
    }
  }
}
function iniciar() {
  if (process.env.ACCOUNT_EMAIL_DELIVERY_ENABLED === 'false') {
    console.warn('Notificaciones de cuenta pausadas por ACCOUNT_EMAIL_DELIVERY_ENABLED');
  } else if (!process.env.CLOUDFLARE_EMAIL_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.warn('Notificaciones de cuenta pendientes: faltan credenciales de Cloudflare Email');
  } else {
    console.log('Procesamiento de notificaciones de cuenta iniciado');
  }
  // También funciona cuando no hay un proceso worker independiente.
  const ejecutar = () => tick().catch(() => console.warn('Notificaciones de cuenta pendientes'));
  ejecutar();
  const timer = setInterval(ejecutar, 30000);
  timer.unref();
  return timer;
}
module.exports = { encolar, tick, iniciar };
