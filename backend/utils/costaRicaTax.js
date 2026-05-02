/**
 * Constantes y funciones de cálculo tributario de Costa Rica
 * Período fiscal 2026 — Decreto Ejecutivo N.° 45333-H
 */

// ============================================================
// TRAMOS DE IMPUESTO SOBRE LA RENTA 2026
// Persona Física con Actividad Lucrativa
// ============================================================
const TRAMOS_RENTA_2026 = [
  { desde: 0,          hasta: 6244000,  tasa: 0    },
  { desde: 6244000,    hasta: 8329000,  tasa: 0.10 },
  { desde: 8329000,    hasta: 10414000, tasa: 0.15 },
  { desde: 10414000,   hasta: 20872000, tasa: 0.20 },
  { desde: 20872000,   hasta: Infinity, tasa: 0.25 },
];

// ============================================================
// CRÉDITOS FISCALES ANUALES 2026
// ============================================================
const CREDITOS_FISCALES_2026 = {
  porHijo: 20520,    // ₡20,520 por cada hijo
  porConyuge: 31080, // ₡31,080 por cónyuge
};

// ============================================================
// MONTO EXENTO DE RENTA 2026
// ============================================================
const MONTO_EXENTO_RENTA_2026 = 6244000;

// ============================================================
// TASAS DE IVA — COSTA RICA
// ============================================================
const TASAS_IVA = {
  EXENTO: 0,
  CANASTA_BASICA: 1,
  AGROPECUARIO: 1,    // Insumos para productores inscritos en MAG
  ORGANICO: 0.5,      // Productos orgánicos certificados (Ley N° 10.256)
  MEDICAMENTOS: 2,
  SALUD_PRIVADA: 4,
  GENERAL: 13,
};

// Mapeo de código de tarifa de Hacienda CR a porcentaje
const CODIGO_TARIFA_A_PORCENTAJE = {
  '01': 0,    // Exento
  '02': 1,    // Tarifa reducida 1%
  '03': 2,    // Tarifa reducida 2%
  '04': 4,    // Tarifa reducida 4%
  '05': 0,    // Transitorio 0%
  '06': 1,    // Transitorio 1%
  '07': 2,    // Transitorio 2%
  '08': 13,   // Tarifa general 13%
};

// ============================================================
// CUATRIMESTRES
// ============================================================
const CUATRIMESTRES = {
  1: { inicio: { mes: 0, dia: 1 }, fin: { mes: 3, dia: 30 }, vencimiento: { mes: 4, dia: 15 } },   // Ene-Abr → Vence 15 Mayo
  2: { inicio: { mes: 4, dia: 1 }, fin: { mes: 7, dia: 31 }, vencimiento: { mes: 8, dia: 15 } },   // May-Ago → Vence 15 Sep
  3: { inicio: { mes: 8, dia: 1 }, fin: { mes: 11, dia: 31 }, vencimiento: { mes: 0, dia: 15 } },  // Sep-Dic → Vence 15 Ene (año+1)
};

/**
 * Obtener el cuatrimestre para una fecha dada
 * @param {Date} fecha
 * @returns {number} 1, 2 o 3
 */
function obtenerCuatrimestre(fecha) {
  const mes = fecha.getMonth(); // 0-11
  if (mes <= 3) return 1;       // Enero-Abril
  if (mes <= 7) return 2;       // Mayo-Agosto
  return 3;                     // Septiembre-Diciembre
}

/**
 * Obtener rango de fechas para un cuatrimestre y año
 * @param {number} cuatrimestre - 1, 2 o 3
 * @param {number} anio - Año fiscal
 * @returns {{ inicio: Date, fin: Date }}
 */
function obtenerRangoFechasCuatrimestre(cuatrimestre, anio) {
  const config = CUATRIMESTRES[cuatrimestre];
  const inicio = new Date(anio, config.inicio.mes, config.inicio.dia);
  const fin = new Date(anio, config.fin.mes, config.fin.dia, 23, 59, 59, 999);
  return { inicio, fin };
}

/**
 * Calcular impuesto de renta por tramos progresivos
 * @param {number} utilidadNeta - Utilidad neta anual en CRC
 * @returns {{ impuesto: number, detalleTramos: Array }}
 */
function calcularImpuestoRentaProgresivo(utilidadNeta) {
  let impuestoTotal = 0;
  const detalleTramos = [];

  for (const tramo of TRAMOS_RENTA_2026) {
    if (utilidadNeta <= tramo.desde) break;

    const base = Math.min(utilidadNeta, tramo.hasta) - tramo.desde;
    const impuestoTramo = base * tramo.tasa;

    detalleTramos.push({
      desde: tramo.desde,
      hasta: Math.min(utilidadNeta, tramo.hasta),
      tasa: tramo.tasa * 100, // Como porcentaje para display
      impuesto: Math.round(impuestoTramo),
    });

    impuestoTotal += impuestoTramo;
  }

  return {
    impuesto: Math.round(impuestoTotal),
    detalleTramos,
  };
}

/**
 * Calcular créditos fiscales
 * @param {number} cantidadHijos
 * @param {boolean} tieneConyuge
 * @returns {{ porHijos: number, porConyuge: number, total: number }}
 */
function calcularCreditosFiscales(cantidadHijos = 0, tieneConyuge = false) {
  const porHijos = cantidadHijos * CREDITOS_FISCALES_2026.porHijo;
  const porConyuge = tieneConyuge ? CREDITOS_FISCALES_2026.porConyuge : 0;
  return {
    porHijos,
    porConyuge,
    total: porHijos + porConyuge,
  };
}

/**
 * Convertir código de tarifa de Hacienda a porcentaje
 * @param {string} codigoTarifa
 * @returns {number}
 */
function codigoTarifaAPorcentaje(codigoTarifa) {
  return CODIGO_TARIFA_A_PORCENTAJE[codigoTarifa] ?? 13;
}

module.exports = {
  TRAMOS_RENTA_2026,
  CREDITOS_FISCALES_2026,
  MONTO_EXENTO_RENTA_2026,
  TASAS_IVA,
  CODIGO_TARIFA_A_PORCENTAJE,
  CUATRIMESTRES,
  obtenerCuatrimestre,
  obtenerRangoFechasCuatrimestre,
  calcularImpuestoRentaProgresivo,
  calcularCreditosFiscales,
  codigoTarifaAPorcentaje,
};
