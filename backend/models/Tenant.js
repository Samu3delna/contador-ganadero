const mongoose = require('mongoose');
const { LIMITES_POR_PLAN, PLANES_VALIDOS } = require('../config/planes');
const { encrypt, decrypt } = require('../utils/crypto');
const { KeyProvider } = require('../utils/keyProvider');

/**
 * Modelo Tenant (Inquilino / Finca) — Aislamiento multi-tenant SaaS
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
    enum: ['dueño', 'admin', 'contador', 'peon'],
    default: 'peon',
  },
  agregadoEn: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

// === Consecutivos atómicos por tipo de comprobante Hacienda v4.4 ===
const consecutivosHaciendaSchema = new mongoose.Schema({
  FE: { type: Number, default: 0 },
  TE: { type: Number, default: 0 },
  NC: { type: Number, default: 0 },
  ND: { type: Number, default: 0 },
  FEC: { type: Number, default: 0 },
  REP: { type: Number, default: 0 },
}, { _id: false });

// === Configuración Hacienda por tenant (credenciales cifradas con AES-256-GCM + AAD) ===
const haciendaConfigSchema = new mongoose.Schema({
  ambiente: {
    type: String,
    enum: ['local', 'sandbox', 'produccion'],
    default: 'local',
  },
  certificadoP12Base64: {
    type: String,
    select: false,
  },
  pinCertificado: {
    type: String,
    select: false,
  },
  usuarioHacienda: {
    type: String,
    select: false,
  },
  passwordHacienda: {
    type: String,
    select: false,
  },
  sucursal: {
    type: String,
    default: '001',
    trim: true,
  },
  terminal: {
    type: String,
    default: '00001',
    trim: true,
  },
  codigoActividad: {
    type: String,
    default: '000000',
    trim: true,
  },
  consecutivos: {
    type: consecutivosHaciendaSchema,
    default: () => ({ FE: 0, TE: 0, NC: 0, ND: 0, FEC: 0, REP: 0 }),
  },
  configuradoEn: {
    type: Date,
  },
  ultimoError: {
    type: String,
  },
}, { _id: false });

// Métodos de cifrado autenticado para configuración Hacienda (con AAD vinculado al tenant y campo)
haciendaConfigSchema.methods.establecerPinCertificado = function (pin) {
  const parentTenantId = this.$parent ? String(this.$parent._id) : 'tenant';
  this.pinCertificado = encrypt(pin, { tenantId: parentTenantId, field: 'configuracionHacienda.pinCertificado' });
};

haciendaConfigSchema.methods.obtenerPinCertificado = function () {
  if (!this.pinCertificado) return null;
  const parentTenantId = this.$parent ? String(this.$parent._id) : 'tenant';
  try {
    return decrypt(this.pinCertificado, { tenantId: parentTenantId, field: 'configuracionHacienda.pinCertificado' });
  } catch {
    return decrypt(this.pinCertificado);
  }
};

haciendaConfigSchema.methods.establecerPasswordHacienda = function (password) {
  const parentTenantId = this.$parent ? String(this.$parent._id) : 'tenant';
  this.passwordHacienda = encrypt(password, { tenantId: parentTenantId, field: 'configuracionHacienda.passwordHacienda' });
};

haciendaConfigSchema.methods.obtenerPasswordHacienda = function () {
  if (!this.passwordHacienda) return null;
  const parentTenantId = this.$parent ? String(this.$parent._id) : 'tenant';
  try {
    return decrypt(this.passwordHacienda, { tenantId: parentTenantId, field: 'configuracionHacienda.passwordHacienda' });
  } catch {
    return decrypt(this.passwordHacienda);
  }
};

haciendaConfigSchema.methods.establecerCertificadoP12 = function (base64) {
  const parentTenantId = this.$parent ? String(this.$parent._id) : 'tenant';
  this.certificadoP12Base64 = encrypt(base64, { tenantId: parentTenantId, field: 'configuracionHacienda.certificadoP12Base64' });
};

haciendaConfigSchema.methods.obtenerCertificadoP12 = function () {
  if (!this.certificadoP12Base64) return null;
  const parentTenantId = this.$parent ? String(this.$parent._id) : 'tenant';
  try {
    return decrypt(this.certificadoP12Base64, { tenantId: parentTenantId, field: 'configuracionHacienda.certificadoP12Base64' });
  } catch {
    return decrypt(this.certificadoP12Base64);
  }
};

haciendaConfigSchema.methods.estaConfigurado = function () {
  return !!(this.certificadoP12Base64 && this.pinCertificado && this.usuarioHacienda && this.passwordHacienda);
};

// === Límites del plan contratado ===
const limitesSchema = new mongoose.Schema({
  conteosMes: { type: Number, default: 5 },
  usuariosTenant: { type: Number, default: 1 },
  almacenamientoMB: { type: Number, default: 100 },
  vlmHabilitado: { type: Boolean, default: false },
  tokensChatMes: { type: Number, default: 100000 },
  moduloContable: { type: Boolean, default: true },
  moduloD150: { type: Boolean, default: false },
  anunciosHabilitados: { type: Boolean, default: true },
  soporte: { type: String, default: 'Comunidad' },
}, { _id: false });

// === Consumo actual ===
const consumoActualSchema = new mongoose.Schema({
  conteosMes: { type: Number, default: 0 },
  tokensChatMes: { type: Number, default: 0 },
  almacenamientoUsadoMB: { type: Number, default: 0 },
  periodoActual: { type: String, default: '' },
}, { _id: false });

const tenantSchema = new mongoose.Schema({
  nombreFinca: {
    type: String,
    required: [true, 'El nombre de la finca es obligatorio'],
    trim: true,
    maxlength: [120, 'El nombre de la finca no puede exceder 120 caracteres'],
  },

  emailAlias: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true,
    index: true,
  },

  // Clave de cifrado de datos por organización (DEK envuelta bajo KEK maestra — Envelope Encryption)
  encryptedDek: {
    type: String,
    select: false,
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
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    },
  },

  // === ONVO Pay ===
  onvoCustomerId: {
    type: String,
  },
  onvoSubscriptionId: {
    type: String,
  },
  onvoPriceId: {
    type: String,
    trim: true,
  },

  // === Límites y consumo ===
  limites: {
    type: limitesSchema,
    default: () => ({}),
  },
  consumoActual: {
    type: consumoActualSchema,
    default: () => ({}),
  },

  // === Configuración Hacienda (facturación electrónica) ===
  configuracionHacienda: {
    type: haciendaConfigSchema,
    default: () => ({}),
  },

  // === Usuarios miembros ===
  usuarios: {
    type: [usuarioTenantSchema],
    default: [],
  },

  // === Owner ===
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    index: true,
  },

  // === Metadata SaaS ===
  canceladoEn: { type: Date },
  suspendidoEn: { type: Date },
  periodoGraciaFin: { type: Date },

}, {
  timestamps: true,
});

// === ÍNDICES ===
tenantSchema.index({ onvoCustomerId: 1 }, { unique: true, sparse: true });
tenantSchema.index({ onvoSubscriptionId: 1 }, { unique: true, sparse: true });

tenantSchema.pre('save', function (next) {
  try {
    if (!this.encryptedDek) {
      const { encryptedDek } = KeyProvider.generateTenantDek(String(this._id));
      this.encryptedDek = encryptedDek;
    }
  } catch {
    // Si EMAIL_ENC_KEY no está configurada en un test unitario aislado, permitir continuar
  }
  next();
});

tenantSchema.statics.obtenerLimitesPlan = function (plan) {
  return LIMITES_POR_PLAN[plan] || LIMITES_POR_PLAN.free;
};

tenantSchema.methods.aplicarPlan = function (plan) {
  this.plan = plan;
  this.limites = this.constructor.obtenerLimitesPlan(plan);
  return this;
};

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

tenantSchema.methods.tieneCreditoConteo = function () {
  return this.estado === 'activo' &&
    (this.consumoActual?.conteosMes || 0) < (this.limites?.conteosMes || 0);
};

tenantSchema.methods.tieneCreditoChat = function () {
  if (this.estado === 'cancelado') return false;
  if (this.estado === 'suspendido') return false;
  return (this.consumoActual?.tokensChatMes || 0) < (this.limites?.tokensChatMes || 0);
};

tenantSchema.methods.estaActivo = function () {
  return ['activo', 'periodo_gracia'].includes(this.estado);
};

/**
 * Incrementa y devuelve de forma atómica el siguiente número consecutivo
 * para un tipo de comprobante electrónico (FE, TE, NC, ND, FEC, REP).
 * @param {'FE'|'TE'|'NC'|'ND'|'FEC'|'REP'} tipoDoc
 * @returns {Promise<number>}
 */
tenantSchema.methods.siguienteConsecutivo = async function (tipoDoc = 'FE') {
  const tiposValidos = ['FE', 'TE', 'NC', 'ND', 'FEC', 'REP'];
  const tipo = tiposValidos.includes(tipoDoc) ? tipoDoc : 'FE';
  const campo = `configuracionHacienda.consecutivos.${tipo}`;

  const actualizado = await this.constructor.findOneAndUpdate(
    { _id: this._id },
    { $inc: { [campo]: 1 } },
    { new: true }
  );

  return actualizado?.configuracionHacienda?.consecutivos?.[tipo] || 1;
};

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
    configuracionHacienda: {},
    usuarios,
    owner: owner || undefined,
  });

  return tenant;
};

tenantSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.encryptedDek;
    if (ret.configuracionHacienda) {
      delete ret.configuracionHacienda.certificadoP12Base64;
      delete ret.configuracionHacienda.pinCertificado;
      delete ret.configuracionHacienda.passwordHacienda;
    }
    return ret;
  },
});

module.exports = mongoose.model('Tenant', tenantSchema);
