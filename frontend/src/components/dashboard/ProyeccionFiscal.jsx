import { Link } from 'react-router-dom';
const crc = new Intl.NumberFormat('es-CR', { style:'currency', currency:'CRC', maximumFractionDigits:0 });
export default function ProyeccionFiscal({ resumen }) {
  const r = resumen.resumen;
  return <section className="producer-panel producer-fiscal"><h2>Tu previsión fiscal</h2><p className="producer-muted">Estimaciones con los registros del período {resumen.periodoFiscal}.</p><dl><div><dt>Renta anual estimada</dt><dd>{crc.format(resumen.rentaProyectada?.impuestoFinal ?? r.rentaAPagar)}</dd></div><div><dt>IVA · Cuatrimestre {resumen.cuatrimestreActual}</dt><dd>{r.ivaCredito > 0 ? `Crédito ${crc.format(r.ivaCredito)}` : crc.format(r.ivaAPagar)}</dd></div></dl><p className="producer-muted">Revisa el detalle antes de preparar tu declaración.</p><Link to="/impuestos" className="producer-action">Consultar impuestos</Link></section>;
}
