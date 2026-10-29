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
 * 3. Busca SubscriptionEvent por eventoId (`<tipo>:<id del objeto>`)
 *    - Si existe → responde 200 {received:true, duplicate:true} y no procesa
 *    - Si no existe → guarda evento, procesa lógica, responde 200 {received:true}
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
  const existente = await this.findOne({ eventoId: params.eventoId }, null, { skipTenant: true });
  if (existente) {
    return { created: false, event: existente };
  }
  const event = new this(params);
  event.$locals = event.$locals || {};
  event.$locals.skipTenant = true;
  await event.save();
  return { created: true, event };
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
