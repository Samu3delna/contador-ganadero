const { obtenerFuentes } = require('./contabilidadService');
/**
 * Motor de cálculo tributario de Costa Rica
 * IVA Cuatrimestral (D-135-1) y Renta Anual (D-101)
 */

const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const Usuario = require('../models/Usuario');
const {
  obtenerRangoFechasCuatrimestre,
  calcularImpuestoRentaProgresivo,
  calcularCreditosFiscales,
  obtenerCuatrimestre,
  MONTO_EXENTO_RENTA_2026,
} = require('../utils/costaRicaTax');

/**
 * Calcular IVA Cuatrimestral (Formulario D-135-1)
 * @param {import('mongoose').ObjectId|string} usuarioId -backward compat
 * @param {number} cuatrimestre
 * @param {number} anio
 * @param {import('mongoose').ObjectId|string} [tenantId] -aislamiento multi-tenant (preferido)
 */
async function calcularIVACuatrimestral(usuarioId, cuatrimestre, anio, tenantId) {
  const { inicio, fin } = obtenerRangoFechasCuatrimestre(cuatrimestre, anio);

  const { facturas, ingresos } = await obtenerFuentes({ usuarioId, tenantId, inicio, fin });

  // Agrupar IVA pagado por tasa
  const ivaPagadoPorTasa = {};
  let totalIVAPagado = 0;
  let totalGastos = 0;

  facturas.forEach((f) => {
    const ivaPagado = f.esDeducible === false ? 0 : (f.resumenFactura?.totalImpuesto ?? 0);
    const partidas = f.lineaDetalle?.length ? f.lineaDetalle.map(l => ({ tasa: l.impuesto?.tarifa ?? f.tasaIVA ?? 0,
      base: l.subtotal ?? 0, iva: l.impuestoNeto ?? l.impuesto?.monto ?? 0 }))
      : [{ tasa: f.tasaIVA ?? 0, base: f.resumenFactura?.totalVentaNeta ?? 0, iva: ivaPagado }];
    for (const p of partidas) {
      const tasa = f.esDeducible === false ? 0 : p.tasa;
      ivaPagadoPorTasa[tasa] ||= { tasa, basePagada: 0, ivaPagado: 0, baseCobrada: 0, ivaCobrado: 0 };
      ivaPagadoPorTasa[tasa].basePagada += p.base;
      ivaPagadoPorTasa[tasa].ivaPagado += f.esDeducible === false ? 0 : p.iva;
    }
    totalIVAPagado += ivaPagado;
    totalGastos += f.resumenFactura?.totalComprobante || 0;
  });

  // Calcular IVA cobrado en ventas
  let totalIVACobrado = 0;
  let totalIngresos = 0;

  ingresos.forEach((ing) => {
    const ivaCobrado = ing.ivaVenta || 0;
    const partidas = ing.lineaDetalle?.length ? ing.lineaDetalle.map(l => ({ tasa: l.impuesto?.tarifa ?? 0, base: l.subtotal ?? 0, iva: l.impuestoNeto ?? l.impuesto?.monto ?? 0 }))
      : [{ tasa: ing.tasaIVA ?? 0, base: ing.montoSubtotal ?? 0, iva: ivaCobrado }];
    for (const p of partidas) {
      const tasa = p.tasa;
      ivaPagadoPorTasa[tasa] ||= { tasa, basePagada: 0, ivaPagado: 0, baseCobrada: 0, ivaCobrado: 0 };
      ivaPagadoPorTasa[tasa].baseCobrada += p.base;
      ivaPagadoPorTasa[tasa].ivaCobrado += p.iva;
    }
    totalIVACobrado += ivaCobrado;
    totalIngresos += ing.montoTotal || 0;
  });

  const ivaResultante = totalIVACobrado - totalIVAPagado;

  return {
    cuatrimestre,
    periodoFiscal: anio,
    ivaCobrado: Math.round(totalIVACobrado),
    ivaPagado: Math.round(totalIVAPagado),
    ivaResultante: Math.round(ivaResultante),
    detalleIVAPorTasa: Object.values(ivaPagadoPorTasa).map(d => ({
      ...d,
      basePagada: Math.round(d.basePagada),
      ivaPagado: Math.round(d.ivaPagado),
      baseCobrada: Math.round(d.baseCobrada),
      ivaCobrado: Math.round(d.ivaCobrado),
    })),
    totalIngresos: Math.round(totalIngresos),
    totalGastos: Math.round(totalGastos),
    totalFacturas: facturas.length,
    totalRegistrosIngresos: ingresos.length,
    aPagar: ivaResultante > 0,
    creditoFiscal: ivaResultante < 0,
  };
}

/**
 * Calcular Renta Anual (Formulario D-101)
 * @param {import('mongoose').ObjectId|string} usuarioId
 * @param {number} anio
 * @param {import('mongoose').ObjectId|string} [tenantId] -preferido para aislamiento
 */
async function calcularRentaAnual(usuarioId, anio, tenantId) {
  const inicioAnio = new Date(Date.UTC(anio, 0, 1, 6));
  const finAnio = new Date(Date.UTC(anio+1, 0, 1, 5, 59, 59, 999));

  const { facturas: todasFacturas, ingresos } = await obtenerFuentes({ usuarioId, tenantId, inicio: inicioAnio, fin: finAnio });
  const ingresosBrutos = ingresos.reduce((sum, i) => sum + (i.montoSubtotal ?? 0), 0);
  const gastosBrutos = todasFacturas.reduce((sum, f) => sum + (f.resumenFactura?.totalComprobante ?? 0), 0);
  const gastosDeducibles = todasFacturas.filter(f => f.esDeducible !== false).reduce((sum, f) => sum + (f.resumenFactura?.totalVentaNeta ?? 0), 0);

  // Utilidad neta
  const utilidadNeta = Math.max(ingresosBrutos - gastosDeducibles, 0);

  // Calcular impuesto por tramos
  const { impuesto, detalleTramos } = calcularImpuestoRentaProgresivo(utilidadNeta);

  // Créditos fiscales del usuario
  const usuario = await Usuario.findById(usuarioId);
  const creditos = calcularCreditosFiscales(
    usuario?.cantidadHijos || 0,
    usuario?.tieneConyuge || false
  );

  // Impuesto final
  const impuestoFinal = Math.max(impuesto - creditos.total, 0);

  return {
    periodoFiscal: anio,
    ingresosBrutos: Math.round(ingresosBrutos),
    gastosBrutos: Math.round(gastosBrutos),
    gastosDeducibles: Math.round(gastosDeducibles),
    utilidadNeta: Math.round(utilidadNeta),
    montoExento: MONTO_EXENTO_RENTA_2026,
    rentaImponible: Math.round(Math.max(utilidadNeta - MONTO_EXENTO_RENTA_2026, 0)),
    impuestoCalculado: impuesto,
    creditosFiscales: creditos,
    detalleTramos,
    impuestoFinal,
    totalFacturasDeducibles: todasFacturas.filter(f => f.esDeducible !== false).length,
    totalRegistrosIngresos: ingresos.length,
  };
}

/**
 * Proyección fiscal en tiempo real
 * @param {import('mongoose').ObjectId|string} usuarioId
 * @param {number} [anioQuery]
 * @param {import('mongoose').ObjectId|string} [tenantId] -preferido
 */
async function calcularProyeccion(usuarioId, anioQuery, tenantId) {
  const ahora = new Date();
  const anioActual = anioQuery || ahora.getFullYear();
  const cuatrimestreActual = (anioQuery && anioQuery !== ahora.getFullYear()) ? 3 : obtenerCuatrimestre(ahora);

  const [iva, renta] = await Promise.all([
    calcularIVACuatrimestral(usuarioId, cuatrimestreActual, anioActual, tenantId),
    calcularRentaAnual(usuarioId, anioActual, tenantId),
  ]);

  return {
    cuatrimestreActual,
    periodoFiscal: anioActual,
    ivaProyectado: iva,
    rentaProyectada: renta,
    resumen: {
      totalIngresos: renta.ingresosBrutos,
      totalGastos: renta.gastosBrutos,
      utilidadNeta: renta.utilidadNeta,
      ivaAPagar: iva.ivaResultante > 0 ? iva.ivaResultante : 0,
      ivaCredito: iva.ivaResultante < 0 ? Math.abs(iva.ivaResultante) : 0,
      rentaAPagar: renta.impuestoFinal,
    },
    timestamp: ahora,
  };
}

module.exports = {
  calcularIVACuatrimestral,
  calcularRentaAnual,
  calcularProyeccion,
};
