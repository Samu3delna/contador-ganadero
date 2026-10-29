/**
 * Modelo de RefreshToken para rotación por familia (familyId) y detección de reúso.
 * Nunca almacena el token ni el jti en claro: guarda únicamente jtiHash (SHA-256).
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema(
  {
    jtiHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: 256,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByJtiHash: {
      type: String,
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
    },
    revokeReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

refreshTokenSchema.pre('validate', function (next) {
  if (this.usuarioId && !this.userId) this.userId = this.usuarioId;
  if (this.userId && !this.usuarioId) this.usuarioId = this.userId;
  next();
});

// Eliminación automática por TTL al expirar (7 días)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ usuarioId: 1, revokedAt: 1 });

refreshTokenSchema.statics.hashTokenId = function (jti) {
  return crypto.createHash('sha256').update(String(jti || '')).digest('hex');
};

refreshTokenSchema.statics.hashJti = refreshTokenSchema.statics.hashTokenId;

refreshTokenSchema.statics.revocarFamilia = async function (familyId, reason = 'revoked') {
  if (!familyId) return;
  const now = new Date();
  await this.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: now, revokedReason: reason, revokeReason: reason } }
  );
};

refreshTokenSchema.statics.revocarTodosDeUsuario = async function (usuarioId, reason = 'revoked_all') {
  if (!usuarioId) return;
  const now = new Date();
  await this.updateMany(
    { $or: [{ usuarioId }, { userId: usuarioId }], revokedAt: null },
    { $set: { revokedAt: now, revokedReason: reason, revokeReason: reason } }
  );
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
