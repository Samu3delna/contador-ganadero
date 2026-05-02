const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/crypto');

const usuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    select: false, // No incluir en consultas por defecto
  },
  cedula: {
    tipo: { type: String, enum: ['fisica', 'juridica'], default: 'fisica' },
    numero: { type: String, trim: true },
  },
  nombreFinca: {
    type: String,
    trim: true,
  },
  // Datos para créditos fiscales de Renta
  cantidadHijos: {
    type: Number,
    default: 0,
    min: 0,
  },
  tieneConyuge: {
    type: Boolean,
    default: false,
  },
  // Configuración IMAP del usuario (opcional, si cada usuario tiene su propio correo)
  configEmail: {
    host: String,
    puerto: Number,
    usuario: String,
    password: String, // Encriptada con AES-256-CBC via utils/crypto.js
    tls: { type: Boolean, default: true },
  },
}, {
  timestamps: true,
});

// Hash de contraseña antes de guardar
usuarioSchema.pre('save', async function () {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  if (this.configEmail?.password && this.isModified('configEmail.password')) {
    this.configEmail.password = encrypt(this.configEmail.password);
  }
});

usuarioSchema.methods.getEmailPassword = function () {
  if (!this.configEmail || !this.configEmail.password) return null;
  return decrypt(this.configEmail.password);
};

// Método para comparar contraseñas
usuarioSchema.methods.compararPassword = async function (passwordIngresada) {
  return await bcrypt.compare(passwordIngresada, this.password);
};

module.exports = mongoose.model('Usuario', usuarioSchema);
