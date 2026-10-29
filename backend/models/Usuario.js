const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encryptSecret, decryptSecret } = require('../utils/crypto');

const usuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true,
    maxlength: [120, 'El nombre no puede exceder 120 caracteres'],
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: [160, 'El email no puede exceder 160 caracteres'],
  },
  // === Multi-tenant: cada usuario pertenece a un Tenant (finca) ===
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
    required: false,
  },
  // Rol del usuario dentro del tenant
  rol: {
    type: String,
    enum: ['owner', 'dueño', 'contador', 'peon', 'admin', 'administrador', 'superadmin'],
    default: 'dueño',
  },
  // Flag explícito de Super Admin de plataforma (inmutable desde rutas HTTP de usuario)
  isSuperAdmin: {
    type: Boolean,
    default: false,
    index: true,
  },
  esSuperAdmin: {
    type: Boolean,
    default: false,
  },
  // Suspensión individual (gestionada por Super Admin). Bloquea login, refresh y API.
  suspendido: {
    type: Boolean,
    default: false,
    index: true,
  },
  suspendidoEn: {
    type: Date,
  },
  // Versión de token para revocación inmediata de todos los JWT emitidos al cambiar password/rol/suspender
  tokenVersion: {
    type: Number,
    default: 0,
  },
  // Protección contra fuerza bruta por cuenta
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
    default: null,
  },
  lockCount: {
    type: Number,
    default: 0,
  },
  // Verificación de correo electrónico y recuperación de contraseña (solo hashes SHA-256)
  emailVerificado: {
    type: Boolean,
    default: false,
  },
  emailVerifyTokenHash: {
    type: String,
    select: false,
  },
  emailVerifyExpires: {
    type: Date,
    select: false,
  },
  emailVerificationTokenHash: {
    type: String,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
  },
  resetPasswordTokenHash: {
    type: String,
    select: false,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
    select: false,
  },
  // Autenticación Multifactor (MFA TOTP + códigos de respaldo hasheados)
  mfa: {
    enabled: {
      type: Boolean,
      default: false,
    },
    secretEncrypted: {
      type: String,
      select: false,
    },
    backupCodesHash: {
      type: [String],
      default: [],
      select: false,
    },
    backupCodesHashed: {
      type: [String],
      default: [],
      select: false,
    },
    verifiedAt: {
      type: Date,
    },
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    select: false,
  },
  cedula: {
    tipo: { type: String, enum: ['fisica', 'juridica', 'dimex', 'nite'], default: 'fisica' },
    numero: { type: String, trim: true, maxlength: 20 },
  },
  nombreFinca: {
    type: String,
    trim: true,
    maxlength: 120,
  },
  telefono: {
    type: String,
    trim: true,
    index: true,
    sparse: true,
    maxlength: 25,
  },
  // Datos para créditos fiscales de Renta
  cantidadHijos: {
    type: Number,
    default: 0,
    min: 0,
    max: 30,
  },
  tieneConyuge: {
    type: Boolean,
    default: false,
  },
  // Respaldo legal: fecha y versión de aceptación de Términos y Política de Privacidad
  aceptoTerminosEn: {
    type: Date,
    default: null,
  },
  consentimientoLegal: {
    versionTerminos: { type: String, default: '2026-01' },
    versionPrivacidad: { type: String, default: '2026-01' },
    fechaAceptacion: { type: Date, default: null },
    ipAceptacion: { type: String, default: null },
    userAgentAceptacion: { type: String, default: null },
  },
  // Google OAuth
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  // Facebook / Meta App-Scoped User ID (ASID)
  facebookId: {
    type: String,
    unique: true,
    sparse: true,
  },
  googleAccessToken: {
    type: String,
    select: false,
  },
  googleRefreshToken: {
    type: String,
    select: false,
  },
  // Configuración IMAP del usuario (password cifrada con AES-256-GCM + AAD)
  configEmail: {
    host: String,
    puerto: Number,
    usuario: String,
    password: { type: String, select: false },
    tls: { type: Boolean, default: true },
  },
  // Configuración fiscal para declaraciones
  configuracionFiscal: {
    actividadEconomica: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    regimenTributario: {
      type: String,
      enum: ['Régimen Tradicional', 'Régimen Especial Agropecuario (REA)'],
      default: 'Régimen Especial Agropecuario (REA)',
    },
    frecuenciaIVA: {
      type: String,
      enum: ['mensual', 'cuatrimestral', 'anual'],
      default: 'cuatrimestral',
    },
    depreciacionActivos: [{
      descripcion: { type: String, trim: true, maxlength: 200 },
      valorOriginal: { type: Number, default: 0, min: 0 },
      vidaUtilAnios: { type: Number, default: 5, min: 1, max: 100 },
      anioAdquisicion: { type: Number },
      depreciacionAnual: { type: Number, default: 0, min: 0 },
      activo: { type: Boolean, default: true },
    }],
  },
}, {
  timestamps: true,
});

// Normalizar cedula si se pasa como string directo (compatibilidad con llamadas existentes)
usuarioSchema.pre('validate', function (next) {
  if (typeof this._doc.cedula === 'string' || typeof this.cedula === 'string') {
    const raw = typeof this._doc.cedula === 'string' ? this._doc.cedula : String(this.cedula);
    const numLimpio = raw.replace(/[-\s]/g, '').trim();
    this.cedula = {
      tipo: numLimpio.length === 10 ? 'juridica' : 'fisica',
      numero: numLimpio,
    };
  }
  if (this.esSuperAdmin === true && !this.isSuperAdmin) {
    this.isSuperAdmin = true;
  } else if (this.isSuperAdmin === true && !this.esSuperAdmin) {
    this.esSuperAdmin = true;
  }
  next();
});

// Normalizar 'administrador' -> 'admin' y cifrar secretos antes de guardar
usuarioSchema.pre('save', async function () {
  if (this.rol === 'administrador') {
    this.rol = 'admin';
  }
  if (this.isModified('password') && this.password && !this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  const ownerScope = String(this.tenantId || this._id || 'user');
  if (this.configEmail?.password && this.isModified('configEmail.password') && !this.configEmail.password.startsWith('v2:')) {
    this.configEmail.password = encryptSecret(this.configEmail.password, {
      tenantId: ownerScope,
      fieldName: 'configEmail.password',
    });
  }
  if (this.googleRefreshToken && this.isModified('googleRefreshToken') && !this.googleRefreshToken.startsWith('v2:')) {
    this.googleRefreshToken = encryptSecret(this.googleRefreshToken, {
      tenantId: ownerScope,
      fieldName: 'googleRefreshToken',
    });
  }
});

usuarioSchema.methods.getEmailPassword = function () {
  if (!this.configEmail || !this.configEmail.password) return null;
  const ownerScope = String(this.tenantId || this._id || 'user');
  try {
    return decryptSecret(this.configEmail.password, {
      tenantId: ownerScope,
      fieldName: 'configEmail.password',
    });
  } catch {
    return decryptSecret(this.configEmail.password);
  }
};

usuarioSchema.methods.compararPassword = async function (passwordIngresada) {
  if (!passwordIngresada || !this.password) return false;
  return await bcrypt.compare(String(passwordIngresada), this.password);
};

// Métodos de bloqueo progresivo contra fuerza bruta
usuarioSchema.methods.estaBloqueado = function () {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

usuarioSchema.methods.registrarIntentoFallido = async function () {
  const MAX_INTENTOS = 5;
  this.loginAttempts = (this.loginAttempts || 0) + 1;
  if (this.loginAttempts >= MAX_INTENTOS) {
    this.lockCount = (this.lockCount || 0) + 1;
    // Bloqueo progresivo: 15 min base * 2^(lockCount - 1), máx 24h
    const minutos = Math.min(24 * 60, 15 * Math.pow(2, Math.max(0, this.lockCount - 1)));
    this.lockUntil = new Date(Date.now() + minutos * 60 * 1000);
  }
  await this.save();
};

usuarioSchema.methods.resetearIntentosLogin = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  await this.save();
};

// Métodos para cifrar/descifrar el secreto TOTP de MFA con AES-256-GCM + AAD
usuarioSchema.methods.setMfaSecret = function (secretBase32) {
  if (!this.mfa) this.mfa = {};
  const ownerScope = String(this.tenantId || this._id || 'user');
  this.mfa.secretEncrypted = encryptSecret(secretBase32, {
    tenantId: ownerScope,
    fieldName: 'usuario.mfa.secret',
  });
};

usuarioSchema.methods.getMfaSecret = function () {
  if (!this.mfa?.secretEncrypted) return null;
  const ownerScope = String(this.tenantId || this._id || 'user');
  return decryptSecret(this.mfa.secretEncrypted, {
    tenantId: ownerScope,
    fieldName: 'usuario.mfa.secret',
  });
};

// Asegurar que ninguna serialización JSON exponga hashes o secretos
usuarioSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.googleAccessToken;
    delete ret.googleRefreshToken;
    delete ret.resetPasswordTokenHash;
    delete ret.resetPasswordExpires;
    delete ret.emailVerifyTokenHash;
    delete ret.emailVerifyExpires;
    delete ret.emailVerificationTokenHash;
    delete ret.emailVerificationExpires;
    if (ret.configEmail) {
      delete ret.configEmail.password;
    }
    if (ret.mfa) {
      ret.mfa = { enabled: Boolean(ret.mfa.enabled) };
    }
    return ret;
  },
});

module.exports = mongoose.model('Usuario', usuarioSchema);
