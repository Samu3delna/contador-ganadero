import { TrendingUp, TrendingDown, DollarSign, Receipt } from 'lucide-react';
const crc = new Intl.NumberFormat('es-CR', { style:'currency', currency:'CRC', maximumFractionDigits:0 });
export default function ResumenCards({ resumen: r }) {
  const cards = [
    { title:'Ingresos', value:crc.format(r.totalIngresos), detail:'Acumulado del año fiscal', Icon:TrendingUp, tone:'income' },
    { title:'Gastos', value:crc.format(r.totalGastos), detail:'Acumulado del año fiscal', Icon:TrendingDown, tone:'expense' },
    { title:'Utilidad neta', value:crc.format(r.utilidadNeta), detail:'Resultado del período fiscal', Icon:DollarSign, tone:'profit' },
    { title:'IVA cuatrimestral', value:r.ivaAPagar > 0 ? crc.format(r.ivaAPagar) : r.ivaCredito > 0 ? crc.format(r.ivaCredito) : crc.format(0), detail:r.ivaCredito > 0 ? 'Saldo a favor' : 'Estimado por pagar · D-135-1', Icon:Receipt, tone:'tax' },
  ];
  return <section className="producer-metrics" aria-label="Resumen financiero">{cards.map(({ title,value,detail,Icon,tone }) => <article key={title} className={`producer-metric producer-metric--${tone}`}><div className="producer-metric-heading"><h2>{title}</h2><Icon size={20} aria-hidden="true" /></div><p className="producer-metric-value">{value}</p><p className="producer-muted">{detail}</p></article>)}</section>;
}
