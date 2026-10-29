/**
 * Modelo de Invitación a Organización (Tenant) de un solo uso.
 * Guarda únicamente el hash SHA-256 del token de invitación y expira en 48 horas.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const invitacionTenantSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    emailInvitado: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    rolAsignado: {
      type: String,
      enum: ['admin', 'contador', 'peon'],
      default: 'peon',
      required: true,
    },
    invitadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usadaEn: {
      type: Date,
      default: null,
    },
    usadaPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

invitacionTenantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

invitacionTenantSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash('sha256').update(`tenant-invite:${String(rawToken || '')}`).digest('hex');
};

module.exports = mongoose.model('InvitacionTenant', invitacionTenantSchema);
