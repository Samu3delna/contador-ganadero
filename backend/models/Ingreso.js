const mongoose = require('mongoose');

const ingresoSchema = new mongoose.Schema({
  fecha: {
    type: Date,
    required: [true, 'La fecha es obligatoria'],
    index: true,
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    trim: true,
  },
  tipoGanado: {
    type: String,
    enum: ['novillo', 'vaca', 'ternero', 'ternera', 'toro', 'vaquilla', 'buey', 'otro'],
    required: [true, 'El tipo de ganado es obligatorio'],
  },
  cantidadCabezas: {
    type: Number,
    required: [true, 'La cantidad de cabezas es obligatoria'],
    min: [1, 'Debe ser al menos 1 cabeza'],
  },
  precioUnitario: {
    type: Number,
    required: [true, 'El precio unitario es obligatorio'],
    min: [0, 'El precio no puede ser negativo'],
  },
  montoTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  // IVA de la venta
  tasaIVA: {
    type: Number,
    default: 0, // Muchas ventas agropecuarias están exentas o al 1%
  },
  ivaVenta: {
    type: Number,
    default: 0,
  },
  // Datos del comprador
  comprador: {
    nombre: { type: String, trim: true },
    cedula: { type: String, trim: true },
  },
  // Factura emitida por el ganadero
  facturaAsociada: String, // Clave numérica si emitió factura

  // Período fiscal
  cuatrimestre: {
    type: Number,
    enum: [1, 2, 3],
  },
  periodoFiscal: Number,

  // Relación
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Calcular monto total e IVA antes de guardar
ingresoSchema.pre('save', function (next) {
  if (this.isModified('cantidadCabezas') || this.isModified('precioUnitario') || this.isModified('tasaIVA')) {
    const subtotal = this.cantidadCabezas * this.precioUnitario;
    this.ivaVenta = subtotal * (this.tasaIVA / 100);
    this.montoTotal = subtotal + this.ivaVenta;
  }
  next();
});

// Índice compuesto
ingresoSchema.index({ usuario: 1, periodoFiscal: 1, cuatrimestre: 1 });
ingresoSchema.index({ usuario: 1, fecha: -1 });

module.exports = mongoose.model('Ingreso', ingresoSchema);
