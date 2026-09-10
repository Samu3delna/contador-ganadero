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
const Ingreso = require('../models/Ingreso'); // ingresos y ventas registradas

//Cuadros CI = credito fiscal soportado (compras), DC = debito fiscal (ventas)
// Alineados con los 4 pasos del Formulario 150 oficial de TRIBU-CR
const CUADROS_VENTAS = [
  { tarifa: 13, label: 'Ventas a 13%', sublabel: 'Tarifa general 13%', campoImporte: 'Total importe ventas a 13%', campoImpuesto: 'Impuesto devengado a 13%' },
  { tarifa: 4, label: 'Ventas a 4%', sublabel: 'Tarifa reducida 4%', campoImporte: 'Total importe ventas a 4%', campoImpuesto: 'Impuesto devengado a 4%' },
  { tarifa: 2, label: 'Ventas a 2%', sublabel: 'Tarifa reducida 2%', campoImporte: 'Total importe ventas a 2%', campoImpuesto: 'Impuesto devengado a 2%' },
  { tarifa: 1, label: 'Ventas a 1%', sublabel: 'Tarifa reducida 1% (agropecuario/canasta básica)', campoImporte: 'Total importe ventas a 1%', campoImpuesto: 'Impuesto devengado a 1%' },
  { tarifa: 0.5, label: 'Ventas a 0.5%', sublabel: 'Tarifa reducida 0.5%', campoImporte: 'Total importe ventas a 0.5%', campoImpuesto: 'Impuesto devengado a 0.5%' },
  { tarifa: 0, label: 'Ventas exentas / no sujetas', sublabel: 'Sin IVA / Exentas', campoImporte: 'Ventas exentas / no sujetas', campoImpuesto: 'Sin impuesto' },
];

const CUADROS_COMPRAS = [
  { tarifa: 0.5, label: 'Compras a 0.5%', campoImporte: 'Total importe compras a 0.5%', campoImpuesto: 'Impuesto soportado a 0.5%' },
  { tarifa: 1, label: 'Compras a 1%', campoImporte: 'Total importe compras a 1%', campoImpuesto: 'Impuesto soportado a 1%' },
  { tarifa: 2, label: 'Compras a 2%', campoImporte: 'Total importe compras a 2%', campoImpuesto: 'Impuesto soportado a 2%' },
  { tarifa: 4, label: 'Compras a 4%', campoImporte: 'Total importe compras a 4%', campoImpuesto: 'Impuesto soportado a 4%' },
  { tarifa: 13, label: 'Compras a 13%', campoImporte: 'Total importe compras a 13%', campoImpuesto: 'Impuesto soportado a 13%' },
  { tarifa: 0, label: 'Compras sin IVA soportado o no acreditable', campoImporte: 'Compras sin IVA soportado o no acreditable', campoImpuesto: 'Sin crédito fiscal' },
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
 *   - Ingreso (ventas registradas de ganado/leche/otros no duplicadas)
 *   - Factura (recibidas via IMAP de proveedores, deducibles y sin error)
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
  // 1) Documentos emitidos electrónicamente por el usuario: FE, TE, REP, NC, ND
  const ventasEmision = await FacturaEmision.find({
    usuario: usuarioId,
    estado: 'aceptada',
    tipoDocumento: { $in: ['FE', 'TE', 'NC', 'ND'] },
    fechaEmision: { $gte: inicio, $lte: fin },
  }).lean();

  // 2) Ingresos registrados en el sistema (ventas en pie, leche, etc.)
  const ingresosRegistrados = await Ingreso.find({
    usuario: usuarioId,
    fecha: { $gte: inicio, $lte: fin },
  }).lean();

  // ============ COMPRAS (Credito Fiscal) ============
  // 1) FEC emitidas por el usuario (compra a no emisores)
  const comprasFec = await FacturaEmision.find({
    usuario: usuarioId,
    estado: 'aceptada',
    tipoDocumento: 'FEC',
    fechaEmision: { $gte: inicio, $lte: fin },
  }).lean();

  // 2) Facturas recibidas (IMAP) válidas de proveedores con FE
  let comprasRecibidas = [];
  try {
    comprasRecibidas = await Factura.find({
      usuario: usuarioId,
      estado: { $ne: 'error' },
      'emisor.cedula.numero': { $exists: true },
      fechaEmision: { $gte: inicio, $lte: fin },
    }).lean();
  } catch (e) {
    console.warn('[D-150] coleccion Factura error:', e.message);
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

  // Acumular ventas electrónicas
  const clavesVentasProcesadas = new Set();
  for (const d of ventasEmision) {
    if (d.claveNumerica) clavesVentasProcesadas.add(d.claveNumerica);
    const esNC = d.tipoDocumento === 'NC';
    const factorSigno = esNC ? -1 : 1;
    for (const l of d.lineaDetalle || []) {
      const tarifa = l.impuesto?.tarifa || 0;
      const base = (l.subtotal || 0) * factorSigno;
      const iva = (l.impuesto?.monto || 0) * factorSigno;
      acumular(ventasPorTarifa, tarifa, base, iva, esNC);
    }
  }

  // Acumular ventas de Ingresos (evitando duplicar si ya están en FacturaEmision)
  for (const ing of ingresosRegistrados) {
    const claveIngreso = ing.facturaElectronica?.claveNumerica;
    if (claveIngreso && clavesVentasProcesadas.has(claveIngreso)) {
      continue;
    }
    const tarifa = ing.tasaIVA != null ? ing.tasaIVA : 0;
    const base = ing.montoSubtotal || 0;
    const iva = ing.ivaVenta || (tarifa > 0 ? (base * tarifa) / 100 : 0);
    acumular(ventasPorTarifa, tarifa, base, iva, false);
  }

  // Acumular compras FEC (Factura Electrónica de Compra)
  for (const d of comprasFec) {
    for (const l of d.lineaDetalle || []) {
      const tarifa = l.impuesto?.tarifa || 0;
      acumular(comprasPorTarifa, tarifa, l.subtotal || 0, l.impuesto?.monto || 0);
    }
  }

  // Acumular compras recibidas por correo (IMAP)
  for (const f of comprasRecibidas) {
    const esDeducible = f.esDeducible !== false;

    // Si NO es deducible, se asigna a "Compras sin IVA soportado o no acreditable" (tarifa 0)
    if (!esDeducible) {
      const subtotalNoDed = Number(f.resumenFactura?.totalVentaNeta || f.resumenFactura?.totalVenta || 0);
      acumular(comprasPorTarifa, 0, subtotalNoDed, 0);
      continue;
    }

    // Si ES deducible, acumular por tarifa (0.5%, 1%, 2%, 4%, 13% o 0% exentas)
    if (Array.isArray(f.lineaDetalle) && f.lineaDetalle.length > 0) {
      for (const l of f.lineaDetalle) {
        const tarifa = l.impuesto?.tarifa != null ? Number(l.impuesto.tarifa) : (Number(f.tasaIVA) || 13);
        const base = Number(l.subtotal || l.baseImponible || 0);
        const iva = Number(l.impuesto?.monto != null ? l.impuesto.monto : (tarifa > 0 ? (base * tarifa) / 100 : 0));
        acumular(comprasPorTarifa, tarifa, base, iva);
      }
    } else {
      // Fallback a resumenFactura
      const resumen = f.resumenFactura || {};
      const base = Number(resumen.totalVentaNeta || resumen.totalVenta || 0);
      const iva = Number(resumen.totalImpuesto || 0);
      let tarifa = f.tasaIVA != null ? Number(f.tasaIVA) : 0;
      if (iva > 0 && base > 0 && tarifa === 0) {
        const ratio = Math.round((iva / base) * 1000) / 10;
        const estandar = [13, 4, 2, 1, 0.5];
        tarifa = estandar.find((t) => Math.abs(ratio - t) <= 0.25) || Math.round(ratio);
      }
      acumular(comprasPorTarifa, tarifa, base, iva);
    }
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

  // ============ Detalle por cuadro (alineado a TRIBU-CR) ============
  const detalleVentas = CUADROS_VENTAS.map((c) => {
    const key = String(c.tarifa);
    const b = ventasPorTarifa[key] || { base: 0, iva: 0, count: 0, ncMonto: 0 };
    return {
      tarifa: c.tarifa,
      label: c.label,
      sublabel: c.sublabel,
      campoImporte: c.campoImporte,
      campoImpuesto: c.campoImpuesto,
      cantidadDocumentos: b.count,
      totalImporte: round2(b.base),
      baseImponible: round2(b.base),
      impuestoDevengado: round2(b.iva),
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
      campoImporte: c.campoImporte,
      campoImpuesto: c.campoImpuesto,
      cantidadDocumentos: b.count,
      totalImporte: round2(b.base),
      baseImponible: round2(b.base),
      impuestoSoportado: round2(b.iva),
      ivaCreditoFiscal: round2(b.iva),
    };
  });

  // ============ Lista normalizada de documentos para auditoría ============
  const listaDocumentos = [];

  for (const v of ventasEmision) {
    listaDocumentos.push({
      tipo: 'VENTA',
      tipoDoc: v.tipoDocumento || 'FE',
      fecha: v.fechaEmision ? new Date(v.fechaEmision).toISOString().split('T')[0] : '',
      tercero: v.receptor?.nombre || '',
      cedula: v.receptor?.cedula?.numero ? String(v.receptor.cedula.numero).trim() : '',
      consecutivo: String(v.consecutivo || '').trim(),
      claveNumerica: String(v.claveNumerica || '').trim(),
      subtotal: v.resumenFactura?.totalVentaNeta || 0,
      iva: v.resumenFactura?.totalImpuesto || 0,
      total: v.resumenFactura?.totalComprobante || 0,
      tasaIVA: v.tasaIVA || 1,
    });
  }

  for (const ing of ingresosRegistrados) {
    const clave = ing.facturaElectronica?.claveNumerica;
    if (clave && clavesVentasProcesadas.has(clave)) continue;
    listaDocumentos.push({
      tipo: 'VENTA',
      tipoDoc: 'INGRESO',
      fecha: ing.fecha ? new Date(ing.fecha).toISOString().split('T')[0] : '',
      tercero: ing.comprador?.nombre || '',
      cedula: ing.comprador?.cedula ? String(ing.comprador.cedula).trim() : '',
      consecutivo: String(ing.facturaElectronica?.numero || '').trim(),
      claveNumerica: String(ing.facturaElectronica?.claveNumerica || '').trim(),
      subtotal: ing.montoSubtotal || 0,
      iva: ing.ivaVenta || 0,
      total: ing.montoTotal || 0,
      tasaIVA: ing.tasaIVA || 0,
    });
  }

  for (const c of comprasRecibidas) {
    listaDocumentos.push({
      tipo: 'COMPRA',
      tipoDoc: c.tipoDocumento || 'FE',
      fecha: c.fechaEmision ? new Date(c.fechaEmision).toISOString().split('T')[0] : '',
      tercero: c.emisor?.nombre || '',
      cedula: c.emisor?.cedula?.numero ? String(c.emisor.cedula.numero).trim() : '',
      consecutivo: String(c.consecutivo || '').trim(),
      claveNumerica: String(c.claveNumerica || '').trim(),
      subtotal: c.resumenFactura?.totalVentaNeta || c.resumenFactura?.totalVenta || 0,
      iva: c.resumenFactura?.totalImpuesto || 0,
      total: c.resumenFactura?.totalComprobante || 0,
      tasaIVA: c.tasaIVA || 13,
      esDeducible: c.esDeducible ? 'Sí' : 'No',
    });
  }

  return {
    periodo: { mes, anio, inicio, fin },
    totales,
    detalleVentas,
    detalleCompras,
    documentos: listaDocumentos,
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
