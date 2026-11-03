function periodoCR(fecha = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit' }).formatToParts(fecha);
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}
module.exports = { periodoCR };
