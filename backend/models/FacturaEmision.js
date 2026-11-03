const mongoose = require('mongoose');
function requiereReferencia() { return ['NC','ND','FEC','REP'].includes(this.tipoDocumento || this.ownerDocument?.().tipoDocumento); }

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
    required: function () { return this.ownerDocument().tipoDocumento !== 'REP'; },
    trim: true,
    minlength: 13,
    maxlength: 13,
    match: /^\d{13}$/,
    description: 'Codigo CABYS de 13 digitos obligatorio v4.4',
  },
  descripcion: { type: String, required: true, trim: true },
  cantidad: { type: Number, required: true, min: 0.00001 },
  unidadMedida: { type: String, default: 'Kg', trim: true },
  precioUnitario: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  montoBruto: { type: Number, min: 0 },
  descuento: {
    monto: { type: Number, default: 0, min: 0 },
    naturalezaDescuento: { type: String, trim: true },
    codigoDescuento: { type: String, trim: true },
    codigoDescuentoOtros: { type: String, trim: true },
  },
  impuesto: {
    codigo: { type: String, default: '01' }, // 01 = IVA
    codigoTarifa: {
      type: String,
      enum: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'],
    },
    tarifa: { type: Number, default: 1 },         // 1%
    monto: { type: Number, default: 0 },
    factorIVA: { type: Number }, // Derivado de tarifa; nunca se usa como entrada del cálculo.
    exoneracion: {
      tipoDocumento: { type: String, trim: true },
      numeroDocumento: { type: String, trim: true },
      nombreInstitucion: { type: String, trim: true },
      nombreInstitucionOtros: { type: String, trim: true },
      tipoDocumentoOtros: { type: String, trim: true },
      articulo: { type: Number },
      inciso: { type: Number },
      fechaEmision: { type: String },
      montoExoneracion: { type: Number, default: 0 },
      porcentajeExoneracion: { type: Number, default: 0 },
      tarifaExonerada: { type: Number, min: 0, max: 13 },
    },
  },
  impuestoNeto: { type: Number, default: 0 },
  montoTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const receptorSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  nombreComercial: { type: String, trim: true },
  cedula: {
    tipo: { type: String, default: '02' },
    numero: { type: String, required: true },
  },
  correo: { type: String, trim: true },
  telefono: { type: String, trim: true },
  ubicacion: { type: String, trim: true },
  provincia: { type: String, trim: true },
  canton: { type: String, trim: true },
  distrito: { type: String, trim: true },
  barrio: { type: String, trim: true },
  identificacionExtranjera: { type: String, trim: true },
}, { _id: false });

const facturaEmisionSchema = new mongoose.Schema({
  repOriginalId: { type: mongoose.Schema.Types.ObjectId, ref: 'FacturaEmision' },
  idempotenciaRep: String,
  repSolicitudHash: String,
  reservasRep: [{ _id: false, facturaId: mongoose.Schema.Types.ObjectId, monto: Number }],
  saldoRepReservado: { type: Number, default: 0 },
  reservaRepInicializada: { type: Boolean, default: false },
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
    minlength: 50,
    maxlength: 50,
    description: 'Clave numerica de 50 digitos (v4.4)',
  },
  consecutivo: {
    type: String,
    required: true,
    trim: true,
    description: 'Consecutivo de 20 digitos (3 sucursal + 5 terminal + 2 tipo + 10 secuencia)',
  },
  codigoActividadEmisor: { type: String, trim: true },
  codigoActividadReceptor: { type: String, trim: true },
  proveedorSistemas: { type: String, trim: true, maxlength: 20 },
  moneda: { type: String, default: 'CRC', match: /^[A-Z]{3}$/ },
  tipoCambio: { type: Number, min: 0.00001, default: 1 },
  //Documento de referencia (para NC/ND/REP)
  documentoReferencia: {
    tipoDocReferencia: { type: String, trim: true, required: requiereReferencia, match: /^\d{2}$/ },
    numeroReferencia: { type: String, trim: true, required: requiereReferencia, minlength: 1, maxlength: 50 },
    fechaEmisionReferencia: { type: Date, required: requiereReferencia },
    codigoReferencia: { type: String, trim: true, required: requiereReferencia, match: /^\d{2}$/ },
    razonReferencia: { type: String, trim: true, required: requiereReferencia, minlength: 1, maxlength: 180 },
    tipoDocReferenciaOtros: { type: String, trim: true },
    codigoReferenciaOtros: { type: String, trim: true },
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
    provincia: { type: String, trim: true },
    canton: { type: String, trim: true },
    distrito: { type: String, trim: true },
    barrio: { type: String, trim: true },
    regimen: { type: String, default: 'Régimen Especial Agropecuario (REA)' },
    // Número de inscripción ante el MAG (obligatorio para tarifa 1%)
    numeroMAG: { type: String, trim: true },
  },

  // === Receptor (comprador) ===
  receptor: {
    type: receptorSchema,
    required: function () { return !['TE', 'NC', 'ND'].includes(this.tipoDocumento); },
  },

  // === Detalle ===
  lineaDetalle: [lineaEmisionSchema],

  // === Resumen ===
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
    totalComprobante: { type: Number, default: 0 },
  },

  // === Condiciones ===
  fechaEmision: { type: Date, required: true, default: Date.now },
  condicionVenta: {
    type: String,
    match: /^\d{2}$/,
    default: '01',
  },
  pagos: [{ _id: false, tipoMedioPago: String, totalMedioPago: { type: Number, min: 0 }, medioPagoOtros: String }],
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
  envioIntentadoEn: { type: Date },
  motorHacienda: { type: String },
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
facturaEmisionSchema.index({ tenantId: 1, idempotenciaRep: 1 }, { unique: true, partialFilterExpression: { idempotenciaRep: { $type: 'string' } } });

// Cálculo ordinario a cinco decimales, igual que el contrato numérico del SDK.
// La tarifa procede del catálogo; montos/factorIVA recibidos del cliente se reemplazan.
const TARIFA_POR_CODIGO = Object.freeze({
  '01': 0, '02': 1, '03': 2, '04': 4, '05': 0, '06': 4,
  '07': 8, '08': 13, '09': 0.5, '10': 0, '11': 0,
});
const CODIGO_POR_TARIFA = Object.freeze({ 0: '10', 0.5: '09', 1: '02', 2: '03', 4: '04', 13: '08' });
const round5 = (value) => Number(value.toFixed(5));

facturaEmisionSchema.pre('validate', function () {
  if (!this.isModified('lineaDetalle')) return;
  const resumen = {
    totalServGravados: 0, totalServExentos: 0, totalServExonerado: 0,
    totalMercanciasGravadas: 0, totalMercanciasExentas: 0, totalMercExonerada: 0,
    totalGravado: 0, totalExento: 0, totalExonerado: 0,
    totalVenta: 0, totalDescuentos: 0, totalVentaNeta: 0,
    totalImpuesto: 0, totalComprobante: 0,
  };
  if (!this.lineaDetalle?.length) {
    this.invalidate('lineaDetalle', 'El comprobante requiere al menos una línea');
    return;
  }

  for (const [index, linea] of this.lineaDetalle.entries()) {
    const path = `lineaDetalle.${index}`;
    const tarifa = linea.impuesto?.tarifa ?? 1;
    const codigoTarifa = linea.impuesto?.codigoTarifa || CODIGO_POR_TARIFA[tarifa];
    const descuento = linea.descuento?.monto || 0;
    if (![linea.precioUnitario, linea.cantidad, tarifa, descuento].every(Number.isFinite)) {
      this.invalidate(path, 'Cantidad, precio, descuento y tarifa deben ser números finitos');
      continue;
    }
    if (linea.precioUnitario < 0 || linea.cantidad <= 0 || descuento < 0) {
      this.invalidate(path, 'Cantidad debe ser positiva; precio y descuento no pueden ser negativos');
      continue;
    }
    if (linea.impuesto?.codigo !== '01' || TARIFA_POR_CODIGO[codigoTarifa] !== tarifa) {
      this.invalidate(`${path}.impuesto`, 'La tarifa debe coincidir con el código de IVA v4.4');
      continue;
    }
    if (['05', '06', '07'].includes(codigoTarifa)) {
      this.invalidate(`${path}.impuesto.codigoTarifa`, 'Las tarifas transitorias 05, 06 y 07 no se admiten en comprobantes nuevos');
      continue;
    }
    const bruto = round5(linea.precioUnitario * linea.cantidad);
    if (!Number.isFinite(bruto) || descuento > bruto) {
      this.invalidate(`${path}.descuento`, 'El descuento no puede superar el importe bruto de la línea');
      continue;
    }
    if (descuento > 0 && (!linea.descuento.codigoDescuento || !linea.descuento.naturalezaDescuento)) {
      this.invalidate(`${path}.descuento`, 'Un descuento requiere código y naturaleza de descuento v4.4');
      continue;
    }
    const neto = round5(bruto - descuento);
    const montoImpuesto = round5(neto * tarifa / 100);
    const exoneracion = linea.impuesto.exoneracion;
    const tieneExoneracion = !!(exoneracion?.tipoDocumento || exoneracion?.numeroDocumento ||
      exoneracion?.tarifaExonerada != null || exoneracion?.porcentajeExoneracion);
    let tarifaExonerada = 0;
    if (tieneExoneracion) {
      tarifaExonerada = exoneracion.tarifaExonerada;
      if (!Number.isFinite(tarifaExonerada) || tarifaExonerada < 0 || tarifaExonerada > tarifa ||
          !exoneracion.tipoDocumento || !exoneracion.numeroDocumento ||
          !exoneracion.nombreInstitucion || !exoneracion.fechaEmision) {
        this.invalidate(`${path}.impuesto.exoneracion`, 'Exoneración v4.4 incompleta o tarifaExonerada fuera de la tarifa de IVA');
        continue;
      }
      exoneracion.montoExoneracion = round5(neto * tarifaExonerada / 100);
    }
    const montoExoneracion = tieneExoneracion ? exoneracion.montoExoneracion : 0;
    linea.numeroLinea = index + 1;
    linea.montoBruto = bruto;
    linea.subtotal = neto;
    linea.impuesto.codigoTarifa = codigoTarifa;
    linea.impuesto.factorIVA = tarifa / 100;
    linea.impuesto.monto = montoImpuesto;
    linea.impuestoNeto = round5(montoImpuesto - montoExoneracion);
    linea.montoTotal = round5(neto + linea.impuestoNeto);

    // CABYS 0–4 identifica bienes; 5–9 servicios. Leche/huevo son mercancías.
    const esServicio = Number(String(linea.codigo || '0')[0]) >= 5;
    const exonerado = tarifa > 0 ? round5(bruto * tarifaExonerada / tarifa) : 0;
    const gravado = tarifa > 0 ? round5(bruto - exonerado) : 0;
    const exento = tarifa === 0 ? bruto : 0;
    const nombres = esServicio
      ? ['totalServGravados', 'totalServExentos', 'totalServExonerado']
      : ['totalMercanciasGravadas', 'totalMercanciasExentas', 'totalMercExonerada'];
    [gravado, exento, exonerado].forEach((monto, i) => {
      resumen[nombres[i]] = round5(resumen[nombres[i]] + monto);
    });
    resumen.totalDescuentos = round5(resumen.totalDescuentos + descuento);
    resumen.totalImpuesto = round5(resumen.totalImpuesto + linea.impuestoNeto);
  }
  resumen.totalGravado = round5(resumen.totalServGravados + resumen.totalMercanciasGravadas);
  resumen.totalExento = round5(resumen.totalServExentos + resumen.totalMercanciasExentas);
  resumen.totalExonerado = round5(resumen.totalServExonerado + resumen.totalMercExonerada);
  resumen.totalVenta = round5(resumen.totalGravado + resumen.totalExento + resumen.totalExonerado);
  resumen.totalVentaNeta = round5(resumen.totalVenta - resumen.totalDescuentos);
  resumen.totalComprobante = round5(resumen.totalVentaNeta + resumen.totalImpuesto);
  this.resumenFactura = resumen;
});

const tenantPlugin = require('./plugins/tenantPlugin');
facturaEmisionSchema.index({ claveNumerica: 1 }, { unique: true, sparse: true });
facturaEmisionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('FacturaEmision', facturaEmisionSchema);
