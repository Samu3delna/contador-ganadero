const mongoose = require('mongoose');
// System inbox: only verified webhooks and the background process access it.
// Tenant ownership is resolved before creating any business document.
module.exports = mongoose.model('IngestionEvent', new mongoose.Schema({
  eventKey: { type: String, unique: true, required: true },
  canal: { type: String, enum: ['email', 'whatsapp', 'pdf_pendiente'], required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, index: true },
  payload: mongoose.Schema.Types.Mixed,
  estado: { type: String, enum: ['pendiente', 'procesando', 'completado', 'sin_asignar', 'rechazado'], default: 'pendiente' },
  intentos: { type: Number, default: 0 },
  claimToken: String,
  claimHasta: Date,
  resultado: mongoose.Schema.Types.Mixed,
  ultimoError: String,
}, { timestamps: true }));
