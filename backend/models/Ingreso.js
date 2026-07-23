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
  // Categoría de ingreso según el requerimiento
  categoriaIngreso: {
    type: String,
    enum: ['venta_ganado_pie', 'venta_leche', 'otros_ingresos'],
    required: [true, 'La categoría de ingreso es obligatoria'],
    default: 'venta_ganado_pie',
  },
  // Detalles específicos por categoría
  tipoGanado: {
    type: String,
    enum: ['novillo', 'vaca', 'ternero', 'ternera', 'toro', 'vaquilla', 'buey', 'otro', null],
    default: null,
  },
  cantidadCabezas: {
    type: Number,
    min: [0, 'No puede ser negativo'],
    default: 0,
  },
  pesoTotal: {
    type: Number,
    default: 0, // en kg
  },
  precioPorKilo: {
    type: Number,
    default: 0,
  },
  precioUnitario: {
    type: Number,
    default: 0,
    min: [0, 'El precio no puede ser negativo'],
  },
  litrosVendidos: {
    type: Number,
    default: 0,
  },
  industriaCompradora: {
    type: String,
    trim: true,
  },
  // Otros ingresos
  detalleOtros: {
    type: String,
    trim: true,
  },
  // Montos
  montoSubtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  tasaIVA: {
    type: Number,
    default: 0,
  },
  ivaVenta: {
    type: Number,
    default: 0,
  },
  montoTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  // Datos del comprador
  comprador: {
    nombre: { type: String, trim: true },
    cedula: { type: String, trim: true },
  },
  // Factura emitida por el ganadero
  facturaElectronica: {
    numero: { type: String, trim: true },
    claveNumerica: { type: String, trim: true },
  },

  // Período fiscal
  cuatrimestre: {
    type: Number,
    enum: [1, 2, 3],
  },
  periodoFiscal: Number,

  // Relación
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
    required: false,
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Calcular monto total e IVA antes de la validación
ingresoSchema.pre('validate', function () {
  if (this.isNew || this.isModified('montoSubtotal') || this.isModified('tasaIVA') || this.isModified('cantidadCabezas') || this.isModified('precioUnitario') || this.isModified('pesoTotal') || this.isModified('precioPorKilo')) {
    let subtotal = this.montoSubtotal || 0;
    
    // Si es venta de ganado en pie y se ingresó por peso
    if (this.categoriaIngreso === 'venta_ganado_pie' && this.pesoTotal > 0 && this.precioPorKilo > 0) {
      subtotal = this.pesoTotal * this.precioPorKilo;
    } 
    // Si es venta de ganado por cabeza
    else if (this.categoriaIngreso === 'venta_ganado_pie' && this.cantidadCabezas > 0 && this.precioUnitario > 0) {
      subtotal = this.cantidadCabezas * this.precioUnitario;
    }
    // Si es leche
    else if (this.categoriaIngreso === 'venta_leche' && this.litrosVendidos > 0 && this.precioUnitario > 0) {
      subtotal = this.litrosVendidos * this.precioUnitario;
    }

    this.montoSubtotal = Math.round(subtotal * 100) / 100;
    this.ivaVenta = Math.round(subtotal * (this.tasaIVA / 100) * 100) / 100;
    this.montoTotal = this.montoSubtotal + this.ivaVenta;
  }
});

// Índice compuesto
ingresoSchema.index({ tenantId: 1, periodoFiscal: 1, cuatrimestre: 1 });
ingresoSchema.index({ tenantId: 1, fecha: -1 });
ingresoSchema.index({ tenantId: 1, usuario: 1 });

module.exports = mongoose.model('Ingreso', ingresoSchema);
