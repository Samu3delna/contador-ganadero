/**
 * Utilidades de formateo para la aplicación
 */

/**
 * Formatear número como colones costarricenses
 * @param {number} monto
 * @returns {string} Ej: "₡1,234,567.00"
 */
function formatearColones(monto) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto);
}

/**
 * Formatear fecha en formato costarricense
 * @param {Date} fecha
 * @returns {string} Ej: "01/05/2026"
 */
function formatearFecha(fecha) {
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(fecha));
}

/**
 * Formatear porcentaje
 * @param {number} valor - Valor decimal o entero
 * @returns {string}
 */
function formatearPorcentaje(valor) {
  return `${valor}%`;
}

/**
 * Obtener nombre del cuatrimestre
 * @param {number} cuatrimestre
 * @returns {string}
 */
function nombreCuatrimestre(cuatrimestre) {
  const nombres = {
    1: '1er Cuatrimestre (Enero - Abril)',
    2: '2do Cuatrimestre (Mayo - Agosto)',
    3: '3er Cuatrimestre (Septiembre - Diciembre)',
  };
  return nombres[cuatrimestre] || 'Desconocido';
}

/**
 * Obtener nombre legible del tipo de ganado
 * @param {string} tipo
 * @returns {string}
 */
function nombreTipoGanado(tipo) {
  const nombres = {
    novillo: 'Novillo',
    vaca: 'Vaca',
    ternero: 'Ternero',
    ternera: 'Ternera',
    toro: 'Toro',
    vaquilla: 'Vaquilla',
    buey: 'Buey',
    otro: 'Otro',
  };
  return nombres[tipo] || tipo;
}

module.exports = {
  formatearColones,
  formatearFecha,
  formatearPorcentaje,
  nombreCuatrimestre,
  nombreTipoGanado,
};
