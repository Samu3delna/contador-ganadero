const mongoose = require('mongoose');

const detalleIVASchema = new mongoose.Schema({
  tasa: Number,         // 0, 1, 2, 4, 13
  basePagada: Number,
  ivaPagado: Number,
  baseCobrada: Number,
  ivaCobrado: Number,
}, { _id: false });

const declaracionSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['D-135-1', 'D-101'],
    required: true,
  },
  periodoFiscal: {
    type: Number,
    required: true,
  },
  cuatrimestre: {
    type: Number,
    enum: [1, 2, 3],
    // Solo requerido para D-135-1
  },

  // === IVA Cuatrimestral (D-135-1) ===
  ivaCobrado: { type: Number, default: 0 },
  ivaPagado: { type: Number, default: 0 },
  ivaResultante: { type: Number, default: 0 }, // Positivo = a pagar, Negativo = crédito
  detalleIVAPorTasa: [detalleIVASchema],

  // === Renta Anual (D-101) ===
  ingresosBrutos: { type: Number, default: 0 },
  gastosDeducibles: { type: Number, default: 0 },
  utilidadNeta: { type: Number, default: 0 },
  montoExento: { type: Number, default: 0 },
  rentaImponible: { type: Number, default: 0 },
  impuestoCalculado: { type: Number, default: 0 },
  creditosFiscales: {
    porHijos: { type: Number, default: 0 },
    porConyuge: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  detalleTramos: [{
    desde: Number,
    hasta: Number,
    tasa: Number,
    impuesto: Number,
  }],
  impuestoFinal: { type: Number, default: 0 },

  // === Estado ===
  estado: {
    type: String,
    enum: ['borrador', 'calculada', 'presentada'],
    default: 'borrador',
  },

  // === Relación ===
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
});

declaracionSchema.index({ usuario: 1, tipo: 1, periodoFiscal: 1, cuatrimestre: 1 });

module.exports = mongoose.model('Declaracion', declaracionSchema);
