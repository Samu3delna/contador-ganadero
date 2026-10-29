/**
 * Modelo de Bitácora de Auditoría de Seguridad (Append-Only / Solo Inserción).
 * Registra eventos críticos de seguridad e impide cualquier edición o borrado
 * mediante hooks de Mongoose.
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    fecha: {
      type: Date,
      default: Date.now,
      required: true,
      immutable: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
      immutable: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      immutable: true,
      index: true,
    },
    rol: {
      type: String,
      default: 'anonimo',
      immutable: true,
    },
    accion: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      index: true,
    },
    recurso: {
      type: String,
      default: 'sistema',
      trim: true,
      immutable: true,
    },
    recursoId: {
      type: String,
      default: null,
      immutable: true,
    },
    ip: {
      type: String,
      default: null,
      immutable: true,
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: 300,
      immutable: true,
    },
    resultado: {
      type: String,
      enum: ['exito', 'fallo', 'bloqueado', 'alerta'],
      default: 'exito',
      immutable: true,
      index: true,
    },
    motivo: {
      type: String,
      default: null,
      maxlength: 500,
      immutable: true,
    },
    requestId: {
      type: String,
      default: null,
      immutable: true,
    },
    metadatos: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Índices compuestos para investigación forense y retención (1 año = 31536000 s)
auditLogSchema.index({ tenantId: 1, fecha: -1 });
auditLogSchema.index({ actorId: 1, fecha: -1 });
auditLogSchema.index({ accion: 1, resultado: 1, fecha: -1 });
auditLogSchema.index({ fecha: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

function bloquearMutacionAuditLog(next) {
  const err = new Error('AUDIT_LOG_IMMUTABLE: Los registros de AuditLog son de solo inserción y no pueden modificarse ni eliminarse.');
  err.code = 'AUDIT_LOG_IMMUTABLE';
  err.status = 403;
  next(err);
}

auditLogSchema.pre('updateOne', bloquearMutacionAuditLog);
auditLogSchema.pre('updateMany', bloquearMutacionAuditLog);
auditLogSchema.pre('findOneAndUpdate', bloquearMutacionAuditLog);
auditLogSchema.pre('replaceOne', bloquearMutacionAuditLog);
auditLogSchema.pre('deleteOne', bloquearMutacionAuditLog);
auditLogSchema.pre('deleteMany', bloquearMutacionAuditLog);
auditLogSchema.pre('findOneAndDelete', bloquearMutacionAuditLog);

module.exports = mongoose.model('AuditLog', auditLogSchema);
