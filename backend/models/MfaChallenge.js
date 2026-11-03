const mongoose = require('mongoose');
module.exports = mongoose.model('MfaChallenge', new mongoose.Schema({
  tokenHash: { type: String, unique: true, required: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tokenVersion: Number,
  expiresAt: { type: Date, index: { expires: 0 } },
  usedAt: Date,
}));
