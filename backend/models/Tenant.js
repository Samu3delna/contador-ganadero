const mongoose = require('mongoose');

/**
 * Modelo Tenant (Inquilino / Finca) — Aislamiento multi-tenant SaaS
 *
 * Cada Tenant representa una finca/organización cliente del SaaS.
 * Contiene: plan de suscripción, estado, límites del plan, consumo actual,
 * relación con Stripe, y lista de usuarios miembros (con roles).
 *
 * Hoy: 1 Tenant = 1 Usuario dueño. Mañana: esqueleto preparado para RBAC
 * multi-usuario sin reescribir el esquema.
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
    enum: ['free', 'bronce', 'oro', 'corporativo'],
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
    index: true,
    sparse: true,
  },
  stripeSubscriptionId: {
    type: String,
    index: true,
    sparse: true,
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
const LIMITES_POR_PLAN = {
  free: {
    conteosMes: 5,
    usuariosTenant: 1,
    almacenamientoMB: 100,
    vlmHabilitado: false,
    tokensChatMes: 100000,
    moduloContable: true,
  },
  bronce: {
    conteosMes: 100,
    usuariosTenant: 1,
    almacenamientoMB: 5120,
    vlmHabilitado: false,
    tokensChatMes: 500000,
    moduloContable: true,
  },
  oro: {
    conteosMes: 500,
    usuariosTenant: 3,
    almacenamientoMB: 25600,
    vlmHabilitado: true,
    tokensChatMes: 2000000,
    moduloContable: true,
  },
  corporativo: {
    conteosMes: 5000,
    usuariosTenant: 10,
    almacenamientoMB: 204800,
    vlmHabilitado: true,
    tokensChatMes: 10000000,
    moduloContable: true,
  },
};

/**
 * Devuelve los límites correspondientes a un plan
 * @param {string} plan - free|bronce|oro|corporativo
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
    usuarios: [{ usuarioId: owner, rol: 'dueño', agregadoEn: new Date() }],
    owner,
  });

  return tenant;
};

module.exports = mongoose.model('Tenant', tenantSchema);
