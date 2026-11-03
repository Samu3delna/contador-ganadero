const mongoose = require('mongoose');
module.exports = mongoose.model('AccountNotification', new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tenantId: mongoose.Schema.Types.ObjectId,
  tipo: { type: String, enum: ['reset', 'verify'], required: true },
  tokenHash: { type: String, unique: true, required: true },
  tokenEncrypted: { type: String, select: false },
  estado: { type: String, enum: ['pendiente', 'enviada', 'vencida'], default: 'pendiente' },
  expiresAt: Date,
  claimHasta: Date,
  claimToken: String,
  intentos: { type: Number, default: 0 },
}, { timestamps: true }));
