const mongoose = require('mongoose');

/**
 * Modelo de Facturación Electrónica (Emisión)
 * Para productores agropecuarios del REA que emiten facturas a clientes
 * con tarifa reducida del 1% de IVA.
 */

const lineaEmisionSchema = new mongoose.Schema({
  numeroLinea: { type: Number, required: true },
  //Codigo CABYS de 13 digitos (obligatorio v4.4)
  codigo: {
    type: String,
    required: true,
    trim: true,
    minlength: 13,
    maxlength: 13,
    description: 'Codigo CABYS de 13 digitos obligatorio v4.4',
  },
  descripcion: { type: String, required: true, trim: true },
  cantidad: { type: Number, required: true, min: 0 },
  unidadMedida: { type: String, default: 'kg', trim: true },
  precioUnitario: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  descuento: {
    monto: { type: Number, default: 0, min: 0 },
    naturalezaDescuento: { type: String, trim: true },
  },
  impuesto: {
    codigo: { type: String, default: '01' }, // 01 = IVA
    codigoTarifa: {
      type: String,
      enum: ['01', '02', '03', '04', '05', '06', '07', '08'],
      default: '02', // 02 = 1% (REA)
    },
    tarifa: { type: Number, default: 1 },         // 1%
    monto: { type: Number, default: 0 },
    factorIVA: { type: Number, default: 0.01 },
    exoneracion: {
      tipoDocumento: { type: String, trim: true },
      numeroDocumento: { type: String, trim: true },
      nombreInstitucion: { type: String, trim: true },
      fechaEmision: { type: String },
      montoExoneracion: { type: Number, default: 0 },
      porcentajeExoneracion: { type: Number, default: 0 },
    },
  },
  impuestoNeto: { type: Number, default: 0 },
  montoTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const facturaEmisionSchema = new mongoose.Schema({
  // === Identificacion v4.4 ===
  tipoDocumento: {
    type: String,
    enum: ['FE', 'TE', 'NC', 'ND', 'FEC', 'REP'],
    required: true,
    default: 'FE',
    description: 'FE=Factura, TE=Tiquete, NC=Nota Credito, ND=Nota Debito, FEC=Factura Electronica Compra, REP=Recibo Electronico Pago',
  },
  ambiente: {
    type: String,
    enum: ['local', 'sandbox', 'produccion'],
    required: true,
    default: 'local',
  },
  claveNumerica: {
    type: String,
    index: true,
    minlength: 50,
    maxlength: 50,
    description: 'Clave numerica de 50 digitos (v4.4)',
  },
  consecutivo: {
    type: String,
    required: true,
    trim: true,
    description: 'Consecutivo de 20 digitos (3 sucursal + 3 terminal + 2 tipo + 10 secuencia)',
  },
  //Documento de referencia (para NC/ND/REP)
  documentoReferencia: {
    tipoDocReferencia: { type: String, trim: true },
    numeroReferencia: { type: String, trim: true },
    fechaEmisionReferencia: { type: String },
    codigoReferencia: { type: String, trim: true },
    razonReferencia: { type: String, trim: true },
  },

  // === Emisor (productor agropecuario) ===
  emisor: {
    nombre: { type: String, required: true },
    nombreComercial: { type: String, trim: true },
    cedula: {
      tipo: { type: String, default: '01' }, // 01 = Física
      numero: { type: String, required: true },
    },
    telefono: { type: String, trim: true },
    correo: { type: String, trim: true },
    ubicacion: { type: String, trim: true },
    regimen: { type: String, default: 'Régimen Especial Agropecuario (REA)' },
    // Número de inscripción ante el MAG (obligatorio para tarifa 1%)
    numeroMAG: { type: String, trim: true },
  },

  // === Receptor (comprador) ===
  receptor: {
    nombre: { type: String, required: true },
    cedula: {
      tipo: { type: String, default: '02' }, // 02 = Jurídica
      numero: { type: String, required: true },
    },
    correo: { type: String, trim: true },
    telefono: { type: String, trim: true },
  },

  // === Detalle ===
  lineaDetalle: [lineaEmisionSchema],

  // === Resumen ===
  resumenFactura: {
    totalServGravados: { type: Number, default: 0 },
    totalServExentos: { type: Number, default: 0 },
    totalMercanciasGravadas: { type: Number, default: 0 },
    totalMercanciasExentas: { type: Number, default: 0 },
    totalGravado: { type: Number, default: 0 },
    totalExento: { type: Number, default: 0 },
    totalVenta: { type: Number, default: 0 },
    totalDescuentos: { type: Number, default: 0 },
    totalVentaNeta: { type: Number, default: 0 },
    totalImpuesto: { type: Number, default: 0 },
    totalComprobante: { type: Number, default: 0 },
  },

  // === Condiciones ===
  fechaEmision: { type: Date, required: true, default: Date.now },
  condicionVenta: {
    type: String,
    enum: ['01', '02', '03'], // 01=Contado, 02=Crédito, 03=Consignación
    default: '01',
  },
  medioPago: [{ type: String }], // 01=Efectivo, 02=Tarjeta, 03=Cheque, 04=Transferencia...
  plazoCredito: { type: String },
  referencia: { type: String, trim: true }, // Número de orden de compra del cliente

  // === Contexto Fiscal REA ===
  esFacturaREA: {
    type: Boolean,
    default: true,
    description: 'Indica si es una factura bajo el Régimen Especial Agropecuario',
  },
  tipoProducto: {
    type: String,
    enum: ['carne_bovino', 'leche', 'huevo', 'tilapia', 'miel', 'otros_productos_rea'],
    required: true,
  },
  // Si el emisor es persona física con actividad empresarial
  esPFyAE: {
    type: Boolean,
    default: false,
    description: 'Persona Física con Actividad Empresarial',
  },

  // === Período fiscal ===
  cuatrimestre: {
    type: Number,
    enum: [1, 2, 3],
  },
  periodoFiscal: Number,

  // === Estado ===
  estado: {
    type: String,
    enum: ['borrador', 'generada', 'firmada', 'enviada_hacienda', 'procesando', 'aceptada', 'rechazada', 'anulada'],
    default: 'borrador',
  },
  fechaEnvioHacienda: { type: Date },
  fechaRespuestaHacienda: { type: Date },
  respuestaHacienda: {
    clave: String,
    estado: String, // aceptado, rechazado, procesando
    detalle: String,
    fecha: Date,
    //URL de consulta devuelta por Hacienda en cabecera Location
    location: { type: String, trim: true },
    //Indica si el XML firmado fue validado correctamente
    indicaciones: String,
  },
  // === XML firmado (v4.4) ===
  xmlFirmado: { type: String, select: false }, // XML completo firmado (XAdES-EPES)
  xmlRespuestaHacienda: { type: String, select: false }, // XML Mensaje Hacienda
  hashFirma: { type: String, trim: true },
  //Errores de validacion propios (no de Hacienda)
  erroresValidacion: [{ type: String }],

  // === Archivos ===
  archivoXML: String, // Ruta al XML firmado
  archivoPDF: String, // Ruta al PDF generado

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

// ============ ÍNDICES ============
facturaEmisionSchema.index({ tenantId: 1, periodoFiscal: 1, cuatrimestre: 1 });
facturaEmisionSchema.index({ tenantId: 1, fechaEmision: -1 });
facturaEmisionSchema.index({ 'emisor.cedula.numero': 1 });
facturaEmisionSchema.index({ tenantId: 1, usuario: 1 });

// ============ PRE-SAVE: Calcular resumen ============
facturaEmisionSchema.pre('save', function () {
  if (!this.isModified('lineaDetalle')) return;

  let totalServGravados = 0;
  let totalServExentos = 0;
  let totalMercanciasGravadas = 0;
  let totalMercanciasExentas = 0;
  let totalDescuentos = 0;
  let totalImpuesto = 0;

  const TARIFA_REA = 0.01;

  for (const linea of this.lineaDetalle) {
    linea.subtotal = Math.round((linea.precioUnitario * linea.cantidad) * 100) / 100;
    const factor = linea.impuesto?.factorIVA != null ? linea.impuesto.factorIVA : TARIFA_REA;
    linea.impuesto.monto = Math.round(linea.subtotal * factor * 100) / 100;
    linea.impuestoNeto = linea.impuesto.monto;
    linea.montoTotal = Math.round((linea.subtotal - (linea.descuento?.monto || 0) + linea.impuestoNeto) * 100) / 100;

    totalDescuentos += linea.descuento?.monto || 0;
    totalImpuesto += linea.impuesto.monto;

    //Clasificar servicio vs mercancia, gravado vs exento
    const tarifa = linea.impuesto?.tarifa || 1;
    const esServicio = this.tipoProducto === 'leche' || this.tipoProducto === 'huevo';
    if (tarifa === 0) {
      if (esServicio) totalServExentos += linea.subtotal;
      else totalMercanciasExentas += linea.subtotal;
    } else {
      if (esServicio) totalServGravados += linea.subtotal;
      else totalMercanciasGravadas += linea.subtotal;
    }
  }

  const totalVenta = this.lineaDetalle.reduce((sum, l) => sum + l.subtotal, 0);
  const totalVentaNeta = totalVenta - totalDescuentos;
  const totalComprobante = totalVentaNeta + totalImpuesto;

  this.resumenFactura = {
    totalServGravados: Math.round(totalServGravados * 100) / 100,
    totalServExentos: Math.round(totalServExentos * 100) / 100,
    totalMercanciasGravadas: Math.round(totalMercanciasGravadas * 100) / 100,
    totalMercanciasExentas: Math.round(totalMercanciasExentas * 100) / 100,
    totalGravado: Math.round(totalVenta * 100) / 100,
    totalExento: Math.round((totalServExentos + totalMercanciasExentas) * 100) / 100,
    totalVenta: Math.round(totalVenta * 100) / 100,
    totalDescuentos: Math.round(totalDescuentos * 100) / 100,
    totalVentaNeta: Math.round(totalVentaNeta * 100) / 100,
    totalImpuesto: Math.round(totalImpuesto * 100) / 100,
    totalComprobante: Math.round(totalComprobante * 100) / 100,
  };
});

module.exports = mongoose.model('FacturaEmision', facturaEmisionSchema);
