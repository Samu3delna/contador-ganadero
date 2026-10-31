const mongoose = require('mongoose');

const ESTADOS_TICKET = ['abierto', 'en_progreso', 'resuelto', 'cerrado'];
const PRIORIDADES_TICKET = ['baja', 'media', 'alta'];
const AUTORES_MENSAJE = ['usuario', 'soporte'];

const mensajeTicketSchema = new mongoose.Schema({
  autor: {
    type: String,
    enum: AUTORES_MENSAJE,
    required: true,
  },
  autorNombre: {
    type: String,
    maxlength: 100,
    default: '',
  },
  texto: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
  // Indica si la notificación por email asociada a este mensaje se envió con éxito
  emailEnviado: {
    type: Boolean,
    default: false,
  },
  // Motivo del fallo del envío (si aplica), para diagnóstico desde el panel
  errorEnvio: {
    type: String,
    maxlength: 500,
  },
}, { _id: true });

const ticketSoporteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    index: true,
    lowercase: true,
    trim: true,
  },
  asunto: {
    type: String,
    required: true,
    maxlength: 200,
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    index: true,
    required: false,
  },
  estado: {
    type: String,
    enum: ESTADOS_TICKET,
    default: 'abierto',
    index: true,
  },
  prioridad: {
    type: String,
    enum: PRIORIDADES_TICKET,
    default: 'media',
  },
  mensajes: [mensajeTicketSchema],
  // Metadatos del envío original (formulario público)
  ip: {
    type: String,
    maxlength: 100,
    default: '',
  },
  userAgent: {
    type: String,
    maxlength: 300,
    default: '',
  },
}, {
  timestamps: true,
});

// Índices para consultas del panel admin
ticketSoporteSchema.index({ estado: 1, createdAt: -1 });
ticketSoporteSchema.index({ email: 1, createdAt: -1 });

const tenantPlugin = require('./plugins/tenantPlugin');
ticketSoporteSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TicketSoporte', ticketSoporteSchema);
module.exports.ESTADOS_TICKET = ESTADOS_TICKET;
module.exports.PRIORIDADES_TICKET = PRIORIDADES_TICKET;
