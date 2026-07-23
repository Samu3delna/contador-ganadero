const mongoose = require('mongoose');

/**
 * Modelo SubscriptionEvent — Log idempotente de webhooks Stripe
 *
 * Garantiza que si Stripe reenvía un evento (lo hace habitualmente),
 * el sistema no lo procese dos veces.
 *
 * Flujo:
 * 1. Stripe envía webhook a /api/stripe/webhook (raw body)
 * 2. Controller valida firma
 * 3. Busca SubscriptionEvent por stripeEventId
 *    - Si existe → responde 200 {received:true, duplicate:true} y no procesa
 *    - Si no existe → guarda evento, procesa lógica, responde 200 {received:true}
 */
const subscriptionEventSchema = new mongoose.Schema({
  // ID único del evento en Stripe (evt_xxx) — usado para idempotencia
  stripeEventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Tipo de evento (ej: checkout.session.completed, invoice.payment_succeeded)
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

  // Cliente Stripe asociado (cus_xxx) — útil para asociar tenant aún no creado
  stripeCustomerId: {
    type: String,
    index: true,
  },

  // Subscription Stripe asociada (sub_xxx)
  stripeSubscriptionId: {
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
 * @param {object} params - { stripeEventId, type, data, stripeCustomerId?, stripeSubscriptionId? }
 * @returns {Promise<{created:boolean, event:object}>}
 */
subscriptionEventSchema.statics.registrarSiNoExiste = async function (params) {
  const existente = await this.findOne({ stripeEventId: params.stripeEventId });
  if (existente) {
    return { created: false, event: existente };
  }
  const event = await this.create(params);
  return { created: true, event };
};

/**
 * Marca un evento como procesado correctamente
 */
subscriptionEventSchema.methods.marcarProcesado = function (tenantId = null) {
  this.procesado = true;
  this.procesadoAt = new Date();
  if (tenantId) this.tenantId = tenantId;
  return this.save();
};

/**
 * Marca un evento como fallido (sin invalidar idempotencia)
 */
subscriptionEventSchema.methods.marcarError = function (mensajeError) {
  this.error = mensajeError;
  this.procesadoAt = new Date();
  return this.save();
};

module.exports = mongoose.model('SubscriptionEvent', subscriptionEventSchema);
