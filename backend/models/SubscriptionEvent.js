const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

/**
 * Modelo SubscriptionEvent — Log idempotente de webhooks ONVO
 *
 * Garantiza que si ONVO reenvía un evento (lo hace habitualmente),
 * el sistema no lo procese dos veces.
 *
 * Flujo:
 * 1. ONVO envía webhook a /api/onvo/webhook (JSON)
 * 2. Controller valida el header X-Webhook-Secret
 * 3. Persiste por eventoId y reclama un lease atómico antes de procesar.
 *    - Completado: responde duplicado sin repetir efectos.
 *    - Pendiente o fallido: admite recuperación; ocupado: solicita reentrega.
 * 4. El ledger del tenant se actualiza atómicamente con cada efecto.
 */
const subscriptionEventSchema = new mongoose.Schema({
  // Llave única del evento (tipo + id del objeto ONVO) — usada para idempotencia
  eventoId: {
    type: String,
    required: true,
    unique: true,
    sparse: true,
    index: true,
  },

  // Tipo de evento (ej: subscription.renewal.succeeded, subscription.renewal.failed)
  type: {
    type: String,
    required: true,
    index: true,
  },

  // Tenant afectado (null si el evento no está asociado aún a un tenant)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  },

  // Cliente ONVO asociado — útil para asociar tenant aún no creado
  customerId: {
    type: String,
    index: true,
  },

  // Cargo recurrente ONVO asociado
  subscriptionId: {
    type: String,
    index: true,
  },

  // Datos crudos del evento (para auditoría/debug)
  data: {
    type: mongoose.Schema.Types.Mixed,
  },

  // Estado de procesamiento
  procesado: {
    type: Boolean,
    default: false,
  },
  procesadoAt: {
    type: Date,
  },
  claimToken: String,
  claimHasta: Date,
  intentos: { type: Number, default: 0 },

  // Mensaje de error si el procesamiento falló (no invalida idempotencia)
  error: {
    type: String,
  },
}, {
  timestamps: true,
});

/**
 * Registra un evento si no existe aún (idempotente)
 * @param {object} params - { eventoId, type, data, customerId?, subscriptionId? }
 * @returns {Promise<{created:boolean, event:object}>}
 */
subscriptionEventSchema.statics.registrarSiNoExiste = async function (params) {
  try {
    const event = await this.findOneAndUpdate(
      { eventoId: params.eventoId }, { $setOnInsert: params },
      { upsert: true, new: true, skipTenant: true, setDefaultsOnInsert: true }
    );
    return { created: !event.procesado, event };
  } catch (error) {
    if (error.code !== 11000) throw error;
    return { created: false, event: await this.findOne({ eventoId: params.eventoId }, null, { skipTenant: true }) };
  }
};

subscriptionEventSchema.statics.reclamar = function (id, claimToken) {
  const ahora = new Date();
  return this.findOneAndUpdate({ _id: id, procesado: { $ne: true },
    $or: [{ claimHasta: { $exists: false } }, { claimHasta: null }, { claimHasta: { $lte: ahora } }] },
  { $set: { claimToken, claimHasta: new Date(ahora.getTime() + 60000) }, $inc: { intentos: 1 } },
  { new: true, skipTenant: true });
};

/**
 * Marca un evento como procesado correctamente
 */
subscriptionEventSchema.methods.marcarProcesado = function (tenantId = null) {
  this.procesado = true;
  this.procesadoAt = new Date();
  if (tenantId) this.tenantId = tenantId;
  this.$locals = this.$locals || {};
  this.$locals.skipTenant = true;
  return this.save();
};

/**
 * Marca un evento como fallido (sin invalidar idempotencia)
 */
subscriptionEventSchema.methods.marcarError = function (mensajeError) {
  this.error = mensajeError;
  this.procesadoAt = new Date();
  this.$locals = this.$locals || {};
  this.$locals.skipTenant = true;
  return this.save();
};

subscriptionEventSchema.plugin(tenantPlugin, { strict: false });

module.exports = mongoose.model('SubscriptionEvent', subscriptionEventSchema);
