const mongoose = require('mongoose');

const chatFeedbackSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true,
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
    required: false,
  },
  mensajeUsuario: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  respuestaIA: {
    type: String,
    required: true,
    maxlength: 10000,
  },
  feedback: {
    type: String,
    enum: ['positivo', 'negativo'],
    required: true,
  },
  comentario: {
    type: String,
    maxlength: 500,
  },
  // Metadata para análisis
  modelo: {
    type: String,
  },
  tokensUsados: {
    type: Number,
  },
  latenciaMs: {
    type: Number,
  },
}, {
  timestamps: true,
});

// Índice para consultas de análisis
chatFeedbackSchema.index({ feedback: 1, createdAt: -1 });
chatFeedbackSchema.index({ usuario: 1, createdAt: -1 });
chatFeedbackSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatFeedback', chatFeedbackSchema);
