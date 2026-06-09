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
 */
async function calcularIVACuatrimestral(usuarioId, cuatrimestre, anio) {
  const { inicio, fin } = obtenerRangoFechasCuatrimestre(cuatrimestre, anio);

  // Obtener facturas (gastos) del cuatrimestre
  const facturas = await Factura.find({
    usuario: usuarioId,
    fechaEmision: { $gte: inicio, $lte: fin },
    estado: { $ne: 'error' },
  });

  // Obtener ingresos (ventas) del cuatrimestre
  const ingresos = await Ingreso.find({
    usuario: usuarioId,
    fecha: { $gte: inicio, $lte: fin },
  });

  // Agrupar IVA pagado por tasa
  const ivaPagadoPorTasa = {};
  let totalIVAPagado = 0;
  let totalGastos = 0;

  facturas.forEach((f) => {
    const tasa = f.tasaIVA || 13;
    const ivaPagado = f.resumenFactura?.totalImpuesto || 0;
    const baseGasto = f.resumenFactura?.totalVenta || 0;

    if (!ivaPagadoPorTasa[tasa]) {
      ivaPagadoPorTasa[tasa] = { tasa, basePagada: 0, ivaPagado: 0, baseCobrada: 0, ivaCobrado: 0 };
    }
    ivaPagadoPorTasa[tasa].basePagada += baseGasto;
    ivaPagadoPorTasa[tasa].ivaPagado += ivaPagado;
    totalIVAPagado += ivaPagado;
    totalGastos += f.resumenFactura?.totalComprobante || 0;
  });

  // Calcular IVA cobrado en ventas
  let totalIVACobrado = 0;
  let totalIngresos = 0;

  ingresos.forEach((ing) => {
    const tasa = ing.tasaIVA || 0;
    const ivaCobrado = ing.ivaVenta || 0;
    const baseIngreso = ing.montoSubtotal || 0;

    if (!ivaPagadoPorTasa[tasa]) {
      ivaPagadoPorTasa[tasa] = { tasa, basePagada: 0, ivaPagado: 0, baseCobrada: 0, ivaCobrado: 0 };
    }
    ivaPagadoPorTasa[tasa].baseCobrada += baseIngreso;
    ivaPagadoPorTasa[tasa].ivaCobrado += ivaCobrado;
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
 */
async function calcularRentaAnual(usuarioId, anio) {
  const inicioAnio = new Date(anio, 0, 1);
  const finAnio = new Date(anio, 11, 31, 23, 59, 59, 999);

  // Ingresos brutos del año
  const ingresos = await Ingreso.find({
    usuario: usuarioId,
    fecha: { $gte: inicioAnio, $lte: finAnio },
  });

  const ingresosBrutos = ingresos.reduce((sum, i) => {
    return sum + (i.montoSubtotal || 0);
  }, 0);

  // Facturas del año
  const todasFacturas = await Factura.find({
    usuario: usuarioId,
    fechaEmision: { $gte: inicioAnio, $lte: finAnio },
    estado: { $ne: 'error' },
  });

  const gastosBrutos = todasFacturas.reduce((sum, f) => {
    return sum + (f.resumenFactura?.totalComprobante || 0);
  }, 0);

  const gastosDeducibles = todasFacturas.filter(f => f.esDeducible).reduce((sum, f) => {
    return sum + (f.resumenFactura?.totalVenta || f.resumenFactura?.totalComprobante || 0);
  }, 0);

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
    totalFacturasDeducibles: todasFacturas.filter(f => f.esDeducible).length,
    totalRegistrosIngresos: ingresos.length,
  };
}

/**
 * Proyección fiscal en tiempo real
 */
async function calcularProyeccion(usuarioId, anioQuery) {
  const ahora = new Date();
  const anioActual = anioQuery || ahora.getFullYear();
  const cuatrimestreActual = (anioQuery && anioQuery !== ahora.getFullYear()) ? 3 : obtenerCuatrimestre(ahora);

  const [iva, renta] = await Promise.all([
    calcularIVACuatrimestral(usuarioId, cuatrimestreActual, anioActual),
    calcularRentaAnual(usuarioId, anioActual),
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
