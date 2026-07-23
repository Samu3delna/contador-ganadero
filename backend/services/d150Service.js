/**
 * Servicio de Conciliacion Tributaria D-150 (IVA mensual).
 *
 * El D-150 es presentado mensualmente por contribuyentes de IVA en la OVI
 * de TRIBU-CR. Hacienda NO expone API de envio; este servicio replica la
 * logica del formulario para auditoria previa.
 *
 * Clasificacion (cuadros D-150):
 *  - Ventas / servicios por tarifa (13%, 4%, 2%, 1%, 0% exento, transitorios)
 *  - Compras / gastos por tarifa (credito fiscal soportado)
 *  - Prorrata de credito fiscal (cuando hay ventas exentas + gravadas)
 *  - Retenciones de tarjeta (datafono) reportadas por bancos
 *
 * Salida apta para:
 *   - Reporte PDF/Excel para contrastar contra OVI
 *   - JSON consumido por frontend
 */

const FacturaEmision = require('../models/FacturaEmision');
const Factura = require('../models/Factura'); // facturas recibidas por IMAP

//Cuadros CI = credito fiscal soportado (compras), DC = debito fiscal (ventas)
const CUADROS_VENTAS = [
  { tarifa: 13, label: 'Tarifa general 13%' },
  { tarifa: 4, label: 'Tarifa reducida 4% (salud privada)' },
  { tarifa: 2, label: 'Tarifa reducida 2% (medicamentos)' },
  { tarifa: 1, label: 'Tarifa reducida 1% (canasta basica / agropecuario)' },
  { tarifa: 0, label: 'Ventas exentas / transitorio 0%' },
];

const CUADROS_COMPRAS = [
  { tarifa: 13, label: 'Compras grabadas al 13%' },
  { tarifa: 4, label: 'Compras grabadas al 4%' },
  { tarifa: 2, label: 'Compras grabadas al 2%' },
  { tarifa: 1, label: 'Compras grabadas al 1% (insumos agropecuarios)' },
  { tarifa: 0, label: 'Compras exentas' },
];

/**
 * Obtiene el rango de meses que cubre una declaracion D-150.
 * @param {number} mes - 1..12 (mes a declarar)
 * @param {number} anio
 */
function rangoMes(mes, anio) {
  const inicio = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
  const fin = new Date(anio, mes, 0, 23, 59, 59, 999);
  return { inicio, fin };
}

/**
 * Genera la conciliacion D-150 para un mes/anio.
 *
 * Fuentes:
 *   - FacturaEmision con tipoDocumento FE/TE/NC/ND/REP/FEC ESTADO aceptada
 *   - Factura (recibidas via IMAP) aceptadas (compras con FE de proveedores)
 *
 * @param {Object} opts
 * @param {string} opts.usuarioId - ObjectId del usuario
 * @param {number} opts.mes - 1..12
 * @param {number} opts.anio
 * @param {number[]} [opts.retencionesTarjeta] - lista de montos retenidos por bancos
 * @param {number} [opts.ivaRetenidoPorTerceros] - iva que otros le retiraron al emisor
 */
async function generarConciliacion({ usuarioId, mes, anio, retencionesTarjeta = [], ivaRetenidoPorTerceros = 0 }) {
  if (!usuarioId) throw new Error('usuarioId requerido');
  if (!mes || !anio) throw new Error('mes y anio son requeridos');

  const { inicio, fin } = rangoMes(mes, anio);

  // ============ VENTAS (Debito Fiscal) ============
  // Documentos emitidos por el usuario: FE, TE, REP, NC, ND
  // NC reducen debito fiscal; ND aumentan
  const ventasEmision = await FacturaEmision.find({
    usuario: usuarioId,
    estado: 'aceptada',
    tipoDocumento: { $in: ['FE', 'TE', 'NC', 'ND'] },
    fechaEmision: { $gte: inicio, $lte: fin },
  }).lean();

  // ============ COMPRAS (Credito Fiscal) ============
  // 1) FEC emitidas por el usuario (compra a no emisores)
  const comprasFec = await FacturaEmision.find({
    usuario: usuarioId,
    estado: 'aceptada',
    tipoDocumento: 'FEC',
    fechaEmision: { $gte: inicio, $lte: fin },
  }).lean();

  // 2) Facturas recibidas (IMAP) aceptadas de proveedores con FE
  let comprasRecibidas = [];
  try {
    comprasRecibidas = await Factura.find({
      usuario: usuarioId,
      estado: 'aceptada', // aceptada por Hacienda
      'emisor.cedula.numero': { $exists: true },
      fechaEmision: { $gte: inicio, $lte: fin },
    }).lean();
  } catch (e) {
    //colección Factura puede no tener estado aceptada todavia
    console.warn('[D-150] coleccion Factura sin estado aceptada:', e.message);
  }

  // ============ Procesar lineas por tarifa ============
  const ventasPorTarifa = {};      // tarifa -> { base, iva, count, ncMonto }
  const comprasPorTarifa = {};    // tarifa -> { base, iva, count }

  function acumular(bucket, tarifa, base, iva, esNC = false) {
    const key = String(tarifa);
    if (!bucket[key]) bucket[key] = { base: 0, iva: 0, count: 0, ncMonto: 0 };
    bucket[key].base += base;
    bucket[key].iva += iva;
    bucket[key].count += 1;
    if (esNC) bucket[key].ncMonto += base + iva;
  }

  for (const d of ventasEmision) {
    const esNC = d.tipoDocumento === 'NC';
    const factorSigno = esNC ? -1 : 1;
    for (const l of d.lineaDetalle || []) {
      const tarifa = l.impuesto?.tarifa || 0;
      const base = (l.subtotal || 0) * factorSigno;
      const iva = (l.impuesto?.monto || 0) * factorSigno;
      acumular(ventasPorTarifa, tarifa, base, iva, esNC);
    }
  }

  for (const d of comprasFec) {
    for (const l of d.lineaDetalle || []) {
      const tarifa = l.impuesto?.tarifa || 0;
      acumular(comprasPorTarifa, tarifa, l.subtotal || 0, l.impuesto?.monto || 0);
    }
  }

  for (const f of comprasRecibidas) {
    // Factura recibida usa resumenFactura (esquema IMAP distinto al de emision)
    const resumen = f.resumenFactura || {};
    const base = resumen.totalVentaNeta || 0;
    const iva = resumen.totalImpuesto || 0;
    // Aproximacion de tarifa por proporcion (cuando no hay lineaDetalle explicita)
    let tarifa = 0;
    if (iva > 0 && base > 0) {
      const ratio = Math.round((iva / base) * 1000) / 10;
      //Snapping a tarifas estandar CR
      const estandar = [13, 4, 2, 1];
      tarifa = estandar.find((t) => Math.abs(ratio - t) <= 0.5) || Math.round(ratio);
    }
    acumular(comprasPorTarifa, tarifa, base, iva);
  }

  // ============ Totales ============
  const totales = {
    ventasGravadasBase: 0,
    ventasIVADebito: 0,
    ventasExentas: 0,
    comprasGravadasBase: 0,
    comprasIVACredito: 0,
    comprasExentas: 0,
  };

  for (const c of CUADROS_VENTAS) {
    const key = String(c.tarifa);
    const bucket = ventasPorTarifa[key] || { base: 0, iva: 0, count: 0, ncMonto: 0 };
    if (c.tarifa > 0) {
      totales.ventasGravadasBase += bucket.base;
      totales.ventasIVADebito += bucket.iva;
    } else {
      totales.ventasExentas += bucket.base;
    }
  }
  for (const c of CUADROS_COMPRAS) {
    const key = String(c.tarifa);
    const bucket = comprasPorTarifa[key] || { base: 0, iva: 0, count: 0 };
    if (c.tarifa > 0) {
      totales.comprasGravadasBase += bucket.base;
      totales.comprasIVACredito += bucket.iva;
    } else {
      totales.comprasExentas += bucket.base;
    }
  }

  // ============ Prorrata de Credito Fiscal ============
  // Formula D-150:
  //   porcentajeDeducible = ventasGravadas / (ventasGravadas + ventasExentas)
  //   creditoDeducible    = comprasIVACredito * porcentajeDeducible
  //   creditoNoDeducible = comprasIVACredito - creditoDeducible
  const totalVentasBrutas = Math.abs(totales.ventasGravadasBase) + Math.abs(totales.ventasExentas);
  const ventasGravadasAbs = Math.abs(totales.ventasGravadasBase);
  const porcentajeProrrata = totalVentasBrutas > 0 ? ventasGravadasAbs / totalVentasBrutas : 1;
  const creditoDeducible = Math.round(totales.comprasIVACredito * porcentajeProrrata);
  const creditoNoDeducible = Math.round(totales.comprasIVACredito - creditoDeducible);

  // ============ Saldo del periodo ============
  // IVA a pagar = debito fiscal + noDeducible - creditoDeducible - retencionesTarjeta - ivaRetenidoPorTerceros
  const totalRetencionesTarjeta = retencionesTarjeta.reduce((s, r) => s + r, 0);
  const debitoFiscal = Math.round(totales.ventasIVADebito);
  const baseImponible = debitoFiscal - creditoDeducible - totalRetencionesTarjeta - ivaRetenidoPorTerceros;
  const ivaAPagar = Math.max(baseImponible, 0);
  const saldoAFavor = baseImponible < 0 ? Math.abs(baseImponible) : 0;

  // ============ Detalle por cuadro ============
  const detalleVentas = CUADROS_VENTAS.map((c) => {
    const key = String(c.tarifa);
    const b = ventasPorTarifa[key] || { base: 0, iva: 0, count: 0, ncMonto: 0 };
    return {
      tarifa: c.tarifa,
      label: c.label,
      cantidadDocumentos: b.count,
      baseImponible: round2(b.base),
      ivaDebitoFiscal: round2(b.iva),
      notasCreditoAplicadas: round2(b.ncMonto),
    };
  });

  const detalleCompras = CUADROS_COMPRAS.map((c) => {
    const key = String(c.tarifa);
    const b = comprasPorTarifa[key] || { base: 0, iva: 0, count: 0 };
    return {
      tarifa: c.tarifa,
      label: c.label,
      cantidadDocumentos: b.count,
      baseImponible: round2(b.base),
      ivaCreditoFiscal: round2(b.iva),
    };
  });

  return {
    periodo: { mes, anio, inicio, fin },
    totales,
    detalleVentas,
    detalleCompras,
    prorrata: {
      porcentajeDeducible: Math.round(porcentajeProrrata * 10000) / 100, //2 dec
      ventasGravadas: round2(totales.ventasGravadasBase),
      ventasExentas: round2(totales.ventasExentas),
      creditoTotal: round2(totales.comprasIVACredito),
      creditoDeducible,
      creditoNoDeducible,
    },
    retencionesTarjeta: {
      detalle: retencionesTarjeta.map((r) => round2(r)),
      total: round2(totalRetencionesTarjeta),
    },
    ivaRetenidoPorTerceros: ivaRetenidoPorTerceros,
    resultadoFinal: {
      debitoFiscal,
      creditoDeducible,
      creditoNoDeducible,
      totalRetencionesTarjeta,
      ivaRetenidoPorTerceros,
      ivaAPagar: round2(ivaAPagar),
      saldoAFavor: round2(saldoAFavor),
    },
    meta: {
      cantidadVentas: ventasEmision.length,
      cantidadComprasFEC: comprasFec.length,
      cantidadComprasRecibidas: comprasRecibidas.length,
      generadoEn: new Date().toISOString(),
    },
  };
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

module.exports = {
  generarConciliacion,
  rangoMes,
  CUADROS_VENTAS,
  CUADROS_COMPRAS,
};
