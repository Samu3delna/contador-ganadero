const Factura = require('../models/Factura');
const FacturaEmision = require('../models/FacturaEmision');
const Ingreso = require('../models/Ingreso');

const numero = value => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) throw new Error('Importe contable no finito');
  return n;
};
const esNC = value => /^(NC|Nota de Cr[eé]dito)$/i.test(value || '');
function normalizarFactura(doc) {
  if (doc._contabilidadNormalizada) return doc;
  const moneda = doc.moneda || 'CRC';
  const cambio = moneda === 'CRC' ? 1 : numero(doc.tipoCambio);
  if (cambio <= 0) throw new Error('Tipo de cambio requerido para reporte en CRC');
  const factor = cambio * (esNC(doc.tipoDocumento) ? -1 : 1);
  const resumen = doc.resumenFactura || {};
  const neto = resumen.totalVentaNeta ?? (numero(resumen.totalVenta) - numero(resumen.totalDescuentos));
  const lineas = (doc.lineaDetalle || []).map(l => {
    const impuesto = l.impuesto || {};
    const exon = l.exoneracion || impuesto.exoneracion || {};
    const impuestoNeto = l.impuestoNeto ?? Math.max(0, numero(impuesto.monto) - numero(exon.montoExoneracion));
    return { ...l, subtotal: numero(l.subtotal ?? l.baseImponible) * factor,
      impuestoNeto: numero(impuestoNeto) * factor,
      impuesto: { ...impuesto, monto: numero(impuesto.monto) * factor },
      montoTotal: numero(l.montoTotal) * factor };
  });
  return { ...doc, _contabilidadNormalizada: true, monedaOriginal: moneda, tipoCambioOriginal: cambio,
    moneda: 'CRC', tipoCambio: 1, lineaDetalle: lineas, resumenFactura: { ...resumen,
      totalVenta: numero(resumen.totalVenta) * factor, totalVentaNeta: numero(neto) * factor,
      totalDescuentos: numero(resumen.totalDescuentos) * factor,
      totalImpuesto: numero(resumen.totalImpuesto) * factor, totalComprobante: numero(resumen.totalComprobante) * factor } };
}

async function obtenerFuentes({ usuarioId, tenantId, inicio, fin }) {
  if (!tenantId && !usuarioId) throw new Error('Scope contable requerido');
  const scope = tenantId ? { tenantId } : { usuario: usuarioId };
  const fechas = inicio || fin ? { ...(inicio ? { $gte: inicio } : {}), ...(fin ? { $lte: fin } : {}) } : null;
  const [recibidas, emitidas, manuales] = await Promise.all([
    Factura.find({ ...scope, estado: { $ne: 'error' }, ...(fechas ? { fechaEmision: fechas } : {}) }).sort({ fechaEmision: 1 }).lean(),
    FacturaEmision.find({ ...scope, estado: 'aceptada', tipoDocumento: { $in: ['FE','TE','NC','ND','FEC'] }, ...(fechas ? { fechaEmision: fechas } : {}) }).sort({ fechaEmision: 1 }).lean(),
    Ingreso.find({ ...scope, ...(fechas ? { fecha: fechas } : {}) }).sort({ fecha: 1 }).lean(),
  ]);
  const ventasEmision = emitidas.filter(d => d.tipoDocumento !== 'FEC').map(normalizarFactura);
  const comprasFec = emitidas.filter(d => d.tipoDocumento === 'FEC').map(normalizarFactura);
  const facturas = recibidas.map(normalizarFactura);
  const clavesCompras = new Set(facturas.map(d => d.claveNumerica).filter(Boolean));
  facturas.push(...comprasFec.filter(d => !d.claveNumerica || !clavesCompras.has(d.claveNumerica)));
  const claves = new Set(ventasEmision.map(d => d.claveNumerica).filter(Boolean));
  const ingresos = ventasEmision.map(d => ({ ...d, fecha: d.fechaEmision,
    descripcion: (d.lineaDetalle || []).map(l => l.descripcion).join('; '),
    comprador: { nombre: d.receptor?.nombre, cedula: d.receptor?.cedula?.numero },
    montoSubtotal: d.resumenFactura.totalVentaNeta, ivaVenta: d.resumenFactura.totalImpuesto, montoTotal: d.resumenFactura.totalComprobante,
    tasaIVA: d.lineaDetalle?.[0]?.impuesto?.tarifa ?? 0,
    facturaElectronica: { numero: d.consecutivo, claveNumerica: d.claveNumerica } }));
  for (const ingreso of manuales) {
    const clave = ingreso.facturaElectronica?.claveNumerica;
    if (clave && claves.has(clave)) continue;
    if (clave) claves.add(clave);
    ingresos.push(ingreso);
  }
  return { facturas, ingresos, ventasEmision, comprasFec };
}
module.exports = { obtenerFuentes, normalizarFactura, esNC };
