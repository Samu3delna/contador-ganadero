const mongoose = require('mongoose');
const { LIMITES_POR_PLAN, PLANES_VALIDOS } = require('../config/planes');

/**
 * Modelo Tenant (Inquilino / Finca) — Aislamiento multi-tenant SaaS
 *
 * Cada Tenant representa una finca/organización cliente del SaaS.
 * Contiene: plan de suscripción, estado, límites del plan, consumo actual,
 * relación con Stripe, y lista de usuarios miembros (con roles).
 *
 * Hoy: 1 Tenant = 1 Usuario dueño. Mañana: esqueleto preparado para RBAC
 * multi-usuario sin reescribir el esquema.
 *
 * Planes vigentes (3): free (Gratis + anuncios) | pro (Pro sin anuncios) |
 * agro (Agro sin anuncios). Los límites se centralizan en config/planes.js.
 */

// === Usuario miembro del tenant (subdoc embebido) ===
const usuarioTenantSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
  },
  rol: {
    type: String,
    enum: ['dueño', 'contador', 'peon'],
    default: 'peon',
  },
  agregadoEn: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

// === Limites del plan contratado ===
const limitesSchema = new mongoose.Schema({
  conteosMes: { type: Number, default: 5 },          // Conteos visuales IA por mes
  usuariosTenant: { type: Number, default: 1 },      // Máx usuarios en el tenant
  almacenamientoMB: { type: Number, default: 100 },   // Cuota de almacenamiento
  vlmHabilitado: { type: Boolean, default: false },   // Acceso a VLM (neva-22b/vila)
  tokensChatMes: { type: Number, default: 100000 },   // Tokens del chat IA por mes
  moduloContable: { type: Boolean, default: true },   // Acceso al módulo contable/fiscal
  moduloD150: { type: Boolean, default: false },      // Acceso al módulo D-150 / conciliación REA
  anunciosHabilitados: { type: Boolean, default: true }, // true = la web muestra anuncios
  soporte: { type: String, default: 'Comunidad' },     // Comunidad | Email | Prioritario
}, { _id: false });

// === Consumo actual (se resetea mensualmente con cron o webhook Stripe) ===
const consumoActualSchema = new mongoose.Schema({
  conteosMes: { type: Number, default: 0 },
  tokensChatMes: { type: Number, default: 0 },
  almacenamientoUsadoMB: { type: Number, default: 0 },
  periodoActual: { type: String, default: '' }, // Formato 'YYYY-MM'
}, { _id: false });

const tenantSchema = new mongoose.Schema({
  nombreFinca: {
    type: String,
    required: [true, 'El nombre de la finca es obligatorio'],
    trim: true,
    maxlength: [120, 'El nombre de la finca no puede exceder 120 caracteres'],
  },

  // === Suscripción ===
  plan: {
    type: String,
    enum: PLANES_VALIDOS,
    default: 'free',
    index: true,
  },
  estado: {
    type: String,
    enum: ['activo', 'suspendido', 'periodo_gracia', 'cancelado'],
    default: 'activo',
    index: true,
  },
  periodoRenovacion: {
    type: Date,
    default: () => {
      // Primer día del mes siguiente
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    },
  },

  // === Stripe ===
  stripeCustomerId: {
    type: String,
  },
  stripeSubscriptionId: {
    type: String,
  },
  stripePriceId: {
    type: String,
    trim: true,
  },

  // === Limites y consumo ===
  limites: {
    type: limitesSchema,
    default: () => ({}),
  },
  consumoActual: {
    type: consumoActualSchema,
    default: () => ({}),
  },

  // === Usuarios miembros ===
  usuarios: {
    type: [usuarioTenantSchema],
    default: [],
  },

  // === Owner (referencia directa para consultas rápidas) ===
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    index: true,
  },

  // === Metadata SaaS ===
  canceladoEn: { type: Date },
  suspendidoEn: { type: Date },
  periodoGraciaFin: { type: Date }, // Fecha límite del periodo de gracia

}, {
  timestamps: true,
});

// === ÍNDICES ===
tenantSchema.index({ stripeCustomerId: 1 }, { unique: true, sparse: true });
tenantSchema.index({ stripeSubscriptionId: 1 }, { unique: true, sparse: true });

// === MÉTODO ESTÁTICO: limites por plan ===
// (la definición de límites vive en config/planes.js para que backend y
// el catálogo público /api/stripe/planes no diverjan)

/**
 * Devuelve los límites correspondientes a un plan
 * @param {string} plan - free|pro|agro
 * @returns {object} limites
 */
tenantSchema.statics.obtenerLimitesPlan = function (plan) {
  return LIMITES_POR_PLAN[plan] || LIMITES_POR_PLAN.free;
};

/**
 * Actualiza los límites del tenant según el plan contratado
 * @param {string} plan
 */
tenantSchema.methods.aplicarPlan = function (plan) {
  this.plan = plan;
  this.limites = this.constructor.obtenerLimitesPlan(plan);
  return this;
};

/**
 * Resetea el consumo mensual (llamado por webhook Stripe o cron)
 */
tenantSchema.methods.resetearConsumo = function () {
  const ahora = new Date();
  this.consumoActual = {
    conteosMes: 0,
    tokensChatMes: 0,
    almacenamientoUsadoMB: this.consumoActual?.almacenamientoUsadoMB || 0,
    periodoActual: `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`,
  };
  return this;
};

/**
 * Verifica si el tenant puede realizar un conteo visual
 */
tenantSchema.methods.tieneCreditoConteo = function () {
  return this.estado === 'activo' &&
    (this.consumoActual?.conteosMes || 0) < (this.limites?.conteosMes || 0);
};

/**
 * Verifica si el tenant puede usar el chat IA
 */
tenantSchema.methods.tieneCreditoChat = function () {
  if (this.estado === 'cancelado') return false;
  if (this.estado === 'suspendido') return false;
  return (this.consumoActual?.tokensChatMes || 0) < (this.limites?.tokensChatMes || 0);
};

/**
 * Verifica si el tenant está activo para operaciones generales
 */
tenantSchema.methods.estaActivo = function () {
  return ['activo', 'periodo_gracia'].includes(this.estado);
};

/**
 * Crea un Tenant nuevo con un usuario dueño
 * @param {object} params - { nombreFinca, owner (UsuarioId), plan? }
 */
tenantSchema.statics.crearParaUsuario = async function ({ nombreFinca, owner, plan = 'free' }) {
  const limites = this.obtenerLimitesPlan(plan);
  const ahora = new Date();
  const periodoActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

  const usuarios = owner ? [{ usuarioId: owner, rol: 'dueño', agregadoEn: new Date() }] : [];

  const tenant = await this.create({
    nombreFinca: nombreFinca || 'Mi Finca',
    plan,
    estado: 'activo',
    limites,
    consumoActual: {
      conteosMes: 0,
      tokensChatMes: 0,
      almacenamientoUsadoMB: 0,
      periodoActual,
    },
    usuarios,
    owner: owner || undefined,
  });

  return tenant;
};

module.exports = mongoose.model('Tenant', tenantSchema);
