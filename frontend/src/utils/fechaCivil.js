export function hoyCivil(ahora = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora);
  return ['year','month','day'].map(tipo => parts.find(p => p.type === tipo).value).join('-');
}
export function mostrarFechaCivil(valor) {
  const civil = String(valor || '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(civil)) return '—';
  const [anio,mes,dia] = civil.split('-'); return `${dia}/${mes}/${anio}`;
}
