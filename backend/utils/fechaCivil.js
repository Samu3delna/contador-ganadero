function parsearFechaCivil(valor) {
  const text = String(valor || '');
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00Z`) : new Date(valor);
  if (!Number.isFinite(fecha.getTime()) || (/^\d{4}-\d{2}-\d{2}$/.test(text) && fecha.toISOString().slice(0,10) !== text)) {
    const error = new Error('Fecha civil inválida'); error.status = 400; throw error;
  }
  return fecha;
}
function inicioMesCR(anio, mesCero) { return new Date(Date.UTC(anio, mesCero, 1, 6)); }
module.exports = { parsearFechaCivil, inicioMesCR };
