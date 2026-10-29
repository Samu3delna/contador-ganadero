/**
 * Utilidad para escapar caracteres especiales en expresiones regulares ($regex)
 * y limitar la longitud de búsqueda a 50 caracteres para prevenir ataques ReDoS
 * e inyección de expresiones regulares en MongoDB.
 */

function escapeRegex(input, maxLength = 50) {
  if (input === null || input === undefined) return '';
  const truncated = String(input).trim().slice(0, maxLength);
  return truncated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  escapeRegex,
};
