const mongoose = require('mongoose');

const lineaDetalleSchema = new mongoose.Schema({
  descripcion: String,
  cantidad: Number,
  unidadMedida: String,
  precioUnitario: Number,
  subtotal: Number,
  descuento: { type: Number, default: 0 },
  impuesto: {
    codigo: String,           // "01" = IVA
    codigoTarifa: String,     // "01"=0%, "02"=1%, "03"=2%, "04"=4%, "08"=13%
    tarifa: Number,           // Porcentaje (0, 1, 2, 4, 13)
    monto: Number,            // Monto del impuesto en esta línea
  },
  montoTotal: Number,
}, { _id: false });

const facturaSchema = new mongoose.Schema({
  // === Datos del XML de Hacienda CR ===
  claveNumerica: {
    type: String,
    unique: true,
    sparse: true, // Permitir null para facturas manuales
    index: true,
  },
  consecutivo: String,
  fechaEmision: {
    type: Date,
    required: [true, 'La fecha de emisión es obligatoria'],
    index: true,
  },
  emisor: {
    nombre: { type: String, required: true },
    cedula: {
      tipo: String,   // "01"=Física, "02"=Jurídica, "03"=DIMEX, "04"=NITE
      numero: String,
    },
    telefono: String,
    correo: String,
    ubicacion: String,
  },
  receptor: {
    nombre: String,
    cedula: {
      tipo: String,
      numero: String,
    },
  },
  lineaDetalle: [lineaDetalleSchema],
  resumenFactura: {
    totalVenta: { type: Number, default: 0 },
    totalDescuentos: { type: Number, default: 0 },
    totalImpuesto: { type: Number, default: 0 },
    totalComprobante: { type: Number, default: 0 },
  },
  moneda: { type: String, default: 'CRC' },

  // === Campos de la aplicación ===
  categoriaIA: {
    type: String,
    enum: [
      'veterinaria', 'alimentacion_animal', 'maquinaria_equipo',
      'transporte', 'servicios_profesionales', 'combustible',
      'mantenimiento', 'seguros', 'insumos_agropecuarios',
      'salarios', 'servicios_publicos', 'otros', 'sin_clasificar',
    ],
    default: 'sin_clasificar',
  },
  subcategoriaIA: String,
  confianzaIA: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
  },
  justificacionIA: String,
  categoriaManual: String, // Override manual del usuario

  tasaIVA: {
    type: Number,
    default: 13,
  },
  esDeducible: {
    type: Boolean,
    default: true,
  },

  // === Período fiscal ===
  cuatrimestre: {
    type: Number,
    enum: [1, 2, 3],
  },
  periodoFiscal: Number, // Año (ej. 2026)

  // === Archivos ===
  archivoXML: String, // Ruta al archivo XML
  archivoPDF: String, // Ruta al archivo PDF

  // === Idempotencia de email ===
  emailUID: {
    type: String,
    index: true,
  },

  // === Estado ===
  estado: {
    type: String,
    enum: ['pendiente', 'procesada', 'error', 'revision'],
    default: 'pendiente',
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

// Índice compuesto para consultas frecuentes
facturaSchema.index({ usuario: 1, periodoFiscal: 1, cuatrimestre: 1 });
facturaSchema.index({ usuario: 1, fechaEmision: -1 });

module.exports = mongoose.model('Factura', facturaSchema);
