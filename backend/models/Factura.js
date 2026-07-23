const mongoose = require('mongoose');

const alertaTarifaSchema = new mongoose.Schema({
  tieneAlerta: Boolean,
  tipoAlerta: {
    type: String,
    enum: ['tarifa_incorrecta', 'tarifa_correcta', 'tarifa_sospechosa', 'normal'],
  },
  severidad: {
    type: String,
    enum: ['error', 'advertencia', 'ok'],
  },
  mensaje: String,
  descripcion: String,
  codigoTarifaActual: String,
  codigoTarifaEsperado: String,
  tarifaActual: Number,
  tarifaEsperada: Number,
  diferenciaIVA: Number,
  categoriaInsumo: String,
  coincidencias: [String],
}, { _id: false });

const lineaDetalleSchema = new mongoose.Schema({
  numeroLinea: Number,
  descripcion: String,
  cantidad: Number,
  unidadMedida: String,
  unidadMedidaComercial: String,
  precioUnitario: Number,
  subtotal: Number,
  descuento: { type: Number, default: 0 },
  descripcionDescuento: String,
  baseImponible: Number,
  impuesto: {
    codigo: String,           // "01" = IVA
    codigoTarifa: String,     // "01"=0%, "02"=1%, "03"=2%, "04"=4%, "08"=13%
    tarifa: Number,           // Porcentaje (0, 1, 2, 4, 13)
    monto: Number,            // Monto del impuesto en esta línea
    factorIVA: Number,        // Factor IVA (v4.4)
    montoExportacion: Number,
  },
  exoneracion: {
    tipoDocumento: String,
    numeroDocumento: String,
    nombreInstitucion: String,
    fechaEmision: String,
    porcentajeExoneracion: Number,
    montoExoneracion: Number,
  },
  impuestoNeto: Number,
  montoTotal: Number,
  codigoComercial: {
    tipo: String,
    codigo: String,
  },
  partidaArancelaria: String,
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
    nombreComercial: String,
    cedula: {
      tipo: String,   // "01"=Física, "02"=Jurídica, "03"=DIMEX, "04"=NITE
      numero: String,
    },
    telefono: String,
    fax: String,
    correo: String,
    ubicacion: String,
  },
  receptor: {
    nombre: String,
    cedula: {
      tipo: String,
      numero: String,
    },
    correo: String,
  },
  lineaDetalle: [lineaDetalleSchema],
  resumenFactura: {
    totalServGravados: { type: Number, default: 0 },
    totalServExentos: { type: Number, default: 0 },
    totalServExonerado: { type: Number, default: 0 },
    totalMercanciasGravadas: { type: Number, default: 0 },
    totalMercanciasExentas: { type: Number, default: 0 },
    totalMercExonerada: { type: Number, default: 0 },
    totalGravado: { type: Number, default: 0 },
    totalExento: { type: Number, default: 0 },
    totalExonerado: { type: Number, default: 0 },
    totalVenta: { type: Number, default: 0 },
    totalDescuentos: { type: Number, default: 0 },
    totalVentaNeta: { type: Number, default: 0 },
    totalImpuesto: { type: Number, default: 0 },
    totalIVADevuelto: { type: Number, default: 0 },
    totalOtrosCargos: { type: Number, default: 0 },
    totalComprobante: { type: Number, default: 0 },
  },
  moneda: { type: String, default: 'CRC' },
  tipoCambio: { type: Number, default: 1 },

  // === Versión y tipo de documento ===
  versionEsquema: { type: String, default: '4.3' },
  tipoDocumento: { type: String, default: 'Factura Electrónica' },
  condicionVenta: String,
  medioPago: [String],

  // === Otros cargos (v4.4) ===
  otrosCargos: [{
    tipoDocumento: String,
    numeroIdentificacion: String,
    nombreTercero: String,
    detalle: String,
    porcentaje: Number,
    monto: Number,
  }],

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
  motivoNoDeducible: {
    type: String,
    trim: true,
  },

  // === Validación de tarifas agropecuarias ===
  alertasTarifa: [alertaTarifaSchema],
  resumenValidacionTarifa: {
    totalLineas: { type: Number, default: 0 },
    alertasError: { type: Number, default: 0 },
    alertasAdvertencia: { type: Number, default: 0 },
    lineasOk: { type: Number, default: 0 },
    ahorrosPerdidos: { type: Number, default: 0 },
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
  carpetaOrigen: {
    type: String,
    default: 'INBOX',
  },

  // === Estado ===
  estado: {
    type: String,
    enum: ['pendiente', 'procesada', 'error', 'revision'],
    default: 'pendiente',
  },

  // === Relación ===
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

// Índice compuesto para consultas frecuentes
facturaSchema.index({ tenantId: 1, periodoFiscal: 1, cuatrimestre: 1 });
facturaSchema.index({ tenantId: 1, fechaEmision: -1 });
facturaSchema.index({ tenantId: 1, 'resumenValidacionTarifa.alertasError': -1 });
facturaSchema.index({ tenantId: 1, usuario: 1 });

module.exports = mongoose.model('Factura', facturaSchema);
