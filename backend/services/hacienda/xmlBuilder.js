/**
 * Adaptación del documento persistido a los builders y XSD v4.4 del SDK.
 * La construcción es asíncrona y nunca utiliza credenciales ni realiza peticiones.
 */
const { cargarSdk } = require('./sdkLoader');
const { TIPO_DOC_CODIGO } = require('./clave50');

const TIPO_DOC_CONFIG = Object.freeze(Object.fromEntries([
  ['FE', 'FacturaElectronica', 'facturaElectronica', 'buildFacturaXml'],
  ['TE', 'TiqueteElectronico', 'tiqueteElectronico', 'buildTiqueteXml'],
  ['NC', 'NotaCreditoElectronica', 'notaCreditoElectronica', 'buildNotaCreditoXml'],
  ['ND', 'NotaDebitoElectronica', 'notaDebitoElectronica', 'buildNotaDebitoXml'],
  ['FEC', 'FacturaElectronicaCompra', 'facturaElectronicaCompra', 'buildFacturaCompraXml'],
  ['REP', 'ReciboElectronicoPago', 'reciboElectronicoPago', 'buildReciboPagoXml'],
].map(([tipo, rootElement, fragmento, builder]) => [tipo, {
  rootElement, namespace: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/' + fragmento,
  schemaLocation: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/' + rootElement + '_V4.4.xsd',
  builder,
}])));

const TARIFAS = Object.freeze({ '01': 0, '02': 1, '03': 2, '04': 4, '05': 0, '06': 4, '07': 8, '08': 13, '09': 0.5, '10': 0, '11': 0 });
// Match the persisted model's rounding at the five decimals used by the SDK.
const round5 = (valor) => Number(valor.toFixed(5));
const texto = (valor) => valor == null || valor === '' ? undefined : String(valor);
const escapeXml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

function fmtFecha(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new Error('fechaEmision inválida');
  return new Date(fecha.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 19) + '-06:00';
}

function monto(valor, campo) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) throw new Error(campo + ' debe ser un número finito no negativo');
  if (Math.abs(valor - round5(valor)) > 1e-9) throw new Error(campo + ' admite hasta cinco decimales');
  return valor;
}

function igual(actual, esperado, campo) {
  if (Math.abs(monto(actual, campo) - round5(esperado)) > 0.000005) {
    throw new Error(campo + ' no coincide con los importes del comprobante; revise el borrador');
  }
}

function parte(persona, esEmisor, tipoDoc) {
  if (!persona?.nombre) {
    if (!esEmisor && ['TE', 'NC', 'ND'].includes(tipoDoc)) return undefined;
    throw new Error((esEmisor ? 'emisor' : 'receptor') + '.nombre es obligatorio');
  }
  const identificacion = persona.cedula?.numero
    ? { tipo: persona.cedula.tipo, numero: String(persona.cedula.numero) }
    : undefined;
  if ((esEmisor || tipoDoc !== 'TE') && !identificacion) throw new Error('La identificación de ambas partes es obligatoria');
  const ubicacion = persona.provincia ? {
    provincia: String(persona.provincia), canton: texto(persona.canton),
    distrito: texto(persona.distrito), barrio: texto(persona.barrio),
    otrasSenas: texto(persona.otrasSenas || persona.ubicacion),
  } : undefined;
  if (esEmisor && tipoDoc !== 'REP' && (!ubicacion?.canton || !ubicacion?.distrito || !ubicacion?.otrasSenas)) {
    throw new Error('Complete provincia, cantón, distrito y otras señas del emisor');
  }
  if (esEmisor && !persona.correo) throw new Error('El correo del emisor es obligatorio');
  const telefono = texto(persona.telefono);
  if (telefono && !/^\d{8,20}$/.test(telefono)) throw new Error('El teléfono debe contener de 8 a 20 dígitos, sin código de país');
  return {
    nombre: persona.nombre, identificacion,
    nombreComercial: texto(persona.nombreComercial), ubicacion,
    telefono: telefono ? { codigoPais: String(persona.codigoPais || '506'), numTelefono: telefono } : undefined,
    correoElectronico: texto(persona.correo),
  };
}

function mapearLinea(linea, indice, tipoDoc) {
  const prefijo = 'lineaDetalle.' + indice;
  if (tipoDoc !== 'REP' && !/^\d{13}$/.test(String(linea.codigo || ''))) throw new Error(prefijo + '.codigo requiere CABYS de 13 dígitos');
  if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0) throw new Error(prefijo + '.cantidad debe ser positiva');
  const bruto = round5(linea.cantidad * monto(linea.precioUnitario, prefijo + '.precioUnitario'));
  const descuento = monto(linea.descuento?.monto || 0, prefijo + '.descuento');
  if (descuento > bruto) throw new Error(prefijo + ': el descuento supera el importe bruto');
  if (tipoDoc === 'REP' && descuento) throw new Error('El REP no admite descuentos en esta integración');
  if (descuento && !linea.descuento?.codigoDescuento) throw new Error(prefijo + ': indique codigoDescuento v4.4');
  const subtotal = round5(bruto - descuento);
  igual(linea.subtotal, subtotal, prefijo + '.subtotal');
  const imp = linea.impuesto || {};
  if (imp.codigo !== '01') throw new Error(prefijo + ': esta integración admite IVA (código 01)');
  if (!Object.hasOwn(TARIFAS, imp.codigoTarifa) || TARIFAS[imp.codigoTarifa] !== imp.tarifa) throw new Error(prefijo + ': código y tarifa de IVA no coinciden');
  const impuesto = round5(subtotal * imp.tarifa / 100);
  igual(imp.monto, impuesto, prefijo + '.impuesto.monto');
  const exo = imp.exoneracion;
  const montoExoneracion = monto(exo?.montoExoneracion || 0, prefijo + '.exoneracion');
  if (montoExoneracion > impuesto) throw new Error(prefijo + ': la exoneración supera el impuesto');
  let exoneracion;
  if (montoExoneracion || exo?.numeroDocumento) {
    const tarifaExonerada = exo.tarifaExonerada ?? exo.porcentajeExoneracion;
    if (!Number.isFinite(tarifaExonerada) || tarifaExonerada < 0 || tarifaExonerada > imp.tarifa) {
      throw new Error(prefijo + ': tarifaExonerada debe estar entre cero y la tarifa del IVA');
    }
    igual(montoExoneracion, subtotal * tarifaExonerada / 100, prefijo + '.exoneracion.montoExoneracion');
    exoneracion = {
      tipoDocumento: texto(exo.tipoDocumento), tipoDocumentoOtros: texto(exo.tipoDocumentoOtros),
      numeroDocumento: texto(exo.numeroDocumento), articulo: exo.articulo, inciso: exo.inciso,
      nombreInstitucion: texto(exo.nombreInstitucion), nombreInstitucionOtros: texto(exo.nombreInstitucionOtros),
      fechaEmision: fmtFecha(exo.fechaEmision), tarifaExonerada, montoExoneracion,
    };
  }
  const impuestoNeto = round5(impuesto - montoExoneracion);
  igual(linea.impuestoNeto, impuestoNeto, prefijo + '.impuestoNeto');
  igual(linea.montoTotal, subtotal + impuestoNeto, prefijo + '.montoTotal');
  return {
    numeroLinea: indice + 1, codigoCabys: tipoDoc === 'REP' ? undefined : String(linea.codigo),
    cantidad: linea.cantidad, unidadMedida: linea.unidadMedida === 'kg' ? 'Kg' : linea.unidadMedida,
    detalle: linea.descripcion, precioUnitario: linea.precioUnitario,
    montoTotal: bruto, subTotal: subtotal, baseImponible: subtotal,
    descuento: descuento ? [{
      montoDescuento: descuento, codigoDescuento: linea.descuento.codigoDescuento,
      codigoDescuentoOtros: texto(linea.descuento.codigoDescuentoOtros),
      naturalezaDescuento: texto(linea.descuento.naturalezaDescuento),
    }] : undefined,
    impuesto: [{ codigo: '01', codigoTarifaIVA: imp.codigoTarifa, tarifa: imp.tarifa, monto: impuesto, exoneracion }],
    impuestoNeto, montoTotalLinea: linea.montoTotal,
  };
}

function mapearResumen(factura, lineas, tipoDoc) {
  const r = factura.resumenFactura || {};
  const suma = (get) => round5(lineas.reduce((total, linea) => total + get(linea), 0));
  igual(r.totalVenta, suma((l) => l.montoTotal), 'resumenFactura.totalVenta');
  igual(r.totalDescuentos || 0, suma((l) => l.descuento?.[0]?.montoDescuento || 0), 'resumenFactura.totalDescuentos');
  igual(r.totalVentaNeta, suma((l) => l.subTotal), 'resumenFactura.totalVentaNeta');
  igual(r.totalImpuesto, suma((l) => l.impuestoNeto), 'resumenFactura.totalImpuesto');
  igual(r.totalComprobante, suma((l) => l.montoTotalLinea), 'resumenFactura.totalComprobante');
  const moneda = factura.moneda || 'CRC';
  const tipoCambio = factura.tipoCambio ?? (moneda === 'CRC' ? 1 : undefined);
  if (!Number.isFinite(tipoCambio) || tipoCambio <= 0 || (moneda === 'CRC' && tipoCambio !== 1)) throw new Error('Tipo de cambio inválido para la moneda del documento');
  let pagos = factura.pagos?.length ? factura.pagos.map((p) => ({
    tipoMedioPago: p.tipoMedioPago, totalMedioPago: monto(p.totalMedioPago, 'pagos.totalMedioPago'),
    medioPagoOtros: texto(p.medioPagoOtros),
  })) : undefined;
  if (!pagos && factura.medioPago?.length) {
    if (factura.medioPago.length !== 1) throw new Error('Indique el importe de cada medio de pago en pagos');
    pagos = [{ tipoMedioPago: factura.medioPago[0], totalMedioPago: r.totalComprobante }];
  }
  if (pagos) igual(pagos.reduce((sum, pago) => sum + pago.totalMedioPago, 0), r.totalComprobante, 'Suma de medios de pago');
  if (tipoDoc === 'REP' && !pagos?.length) throw new Error('El REP requiere medio de pago e importe');
  const desglose = new Map();
  for (const linea of lineas) {
    const tax = linea.impuesto[0];
    const key = tax.codigoTarifaIVA;
    const anterior = desglose.get(key) || 0;
    desglose.set(key, round5(anterior + linea.impuestoNeto));
  }
  const resumen = {
    codigoTipoMoneda: { codigoMoneda: moneda, tipoCambio },
    totalVenta: r.totalVenta, totalVentaNeta: r.totalVentaNeta,
    totalDesgloseImpuesto: [...desglose].map(([codigoTarifaIVA, totalMontoImpuesto]) => ({ codigo: '01', codigoTarifaIVA, totalMontoImpuesto })),
    totalImpuesto: r.totalImpuesto, medioPago: pagos, totalComprobante: r.totalComprobante,
  };
  if (tipoDoc !== 'REP') {
    for (const campo of ['totalServGravados', 'totalServExentos', 'totalServExonerado', 'totalServNoSujeto', 'totalMercanciasGravadas', 'totalMercanciasExentas', 'totalMercExonerada', 'totalMercNoSujeta', 'totalGravado', 'totalExento', 'totalExonerado', 'totalNoSujeto', 'totalDescuentos']) {
      if (r[campo] !== undefined) resumen[campo] = monto(r[campo], 'resumenFactura.' + campo);
    }
    igual((r.totalGravado || 0) + (r.totalExento || 0) + (r.totalExonerado || 0) + (r.totalNoSujeto || 0), r.totalVenta, 'Clasificación del total de venta');
  }
  return resumen;
}

/** Mapeo puro, exportado para pruebas de contrato sin ESM ni servicios externos. */
function mapearDocumento(factura) {
  if (!factura) throw new Error('factura requerida');
  const tipoDoc = factura.tipoDocumento || 'FE';
  if (!Object.hasOwn(TIPO_DOC_CONFIG, tipoDoc)) throw new Error('Tipo de documento desconocido');
  if (!/^506\d{6}[A-Za-z0-9]{12}\d{29}$/.test(factura.claveNumerica || '')) throw new Error('claveNumerica inválida (debe seguir el formato de 50 posiciones)');
  if (!/^\d{20}$/.test(factura.consecutivo || '')) throw new Error('consecutivo inválido (debe ser 20 dígitos)');
  if (!/^[A-Za-z0-9]{9,20}$/.test(String(factura.proveedorSistemas || ''))) throw new Error('Configure la identificación del proveedor del sistema (proveedorSistemas)');
  if (['FE', 'TE'].includes(tipoDoc) && !factura.codigoActividadEmisor) throw new Error('codigoActividadEmisor es obligatorio');
  if (tipoDoc === 'FEC' && !factura.codigoActividadReceptor) throw new Error('FEC requiere codigoActividadReceptor del comprador');
  const ref = factura.documentoReferencia;
  if (['NC', 'ND', 'FEC', 'REP'].includes(tipoDoc) && !ref?.numeroReferencia) throw new Error(tipoDoc + ' requiere documentoReferencia');
  if (tipoDoc === 'REP' && (!['09', '11'].includes(factura.condicionVenta) || ref?.codigoReferencia !== '17')) {
    throw new Error('El REP requiere condición 09/11 y referencia con código 17 (pago de comprobante)');
  }
  if (tipoDoc !== 'REP' && ['09', '11'].includes(factura.condicionVenta)) throw new Error('La condición 09/11 está reservada al REP');
  if (['02', '10'].includes(factura.condicionVenta) && (!/^\d+$/.test(String(factura.plazoCredito || '')) || Number(factura.plazoCredito) <= 0)) throw new Error('Indique un plazo de crédito positivo');
  if (!Array.isArray(factura.lineaDetalle) || !factura.lineaDetalle.length) throw new Error('El comprobante requiere líneas de detalle');
  const lineas = factura.lineaDetalle.map((l, i) => mapearLinea(l, i, tipoDoc));
  return {
    clave: factura.claveNumerica, proveedorSistemas: String(factura.proveedorSistemas),
    numeroConsecutivo: factura.consecutivo, fechaEmision: fmtFecha(factura.fechaEmision),
    codigoActividadEmisor: texto(factura.codigoActividadEmisor),
    codigoActividadReceptor: texto(factura.codigoActividadReceptor),
    emisor: parte(factura.emisor, true, tipoDoc), receptor: parte(factura.receptor, false, tipoDoc),
    condicionVenta: factura.condicionVenta, plazoCredito: texto(factura.plazoCredito),
    detalleServicio: lineas, resumenFactura: mapearResumen(factura, lineas, tipoDoc),
    informacionReferencia: ref?.numeroReferencia ? [{
      tipoDoc: ref.tipoDocReferencia, numero: ref.numeroReferencia,
      fechaEmision: fmtFecha(ref.fechaEmisionReferencia), codigo: texto(ref.codigoReferencia),
      razon: texto(ref.razonReferencia),
    }] : undefined,
    otros: factura.referencia ? [{ contenido: factura.referencia }] : undefined,
  };
}

async function buildXml(factura) {
  const input = mapearDocumento(factura);
  const sdk = await cargarSdk();
  const tipoDoc = factura.tipoDocumento || 'FE';
  if (tipoDoc === 'FE') {
    const resultado = sdk.validateFacturaInput(input);
    if (!resultado.valid) {
      throw new Error('Comprobante inválido: ' + resultado.errors.map((e) => e.path + ': ' + e.message).join('; '));
    }
  }
  const xml = sdk[TIPO_DOC_CONFIG[tipoDoc].builder](input);
  const validacion = await sdk.validateDocumentXml(xml);
  if (!validacion.valid) throw new Error('XML v4.4 inválido: ' + validacion.issues.join('; '));
  return xml;
}

module.exports = { buildXml, mapearDocumento, TIPO_DOC_CONFIG, TIPO_DOC_CODIGO, fmtFecha, escapeXml };
