import { useState } from 'react';
import ResumenCards from '../dashboard/ResumenCards';
const months = ['Enero','Febrero','Marzo','Abril'];
const income = [740000,920000,810000,1050000];
const expenses = [420000,510000,460000,590000];
const explanations = {
 Ingresos: 'Ventas registradas durante el período seleccionado. Revisa los comprobantes y las fechas para interpretar el total.',
 Gastos: 'Compras y gastos registrados. La clasificación permite distinguir en qué se utilizan los recursos de la finca.',
 'IVA cuatrimestral': 'Estimación del período a partir de los registros. Este ejemplo no calcula una declaración tributaria.',
 'Utilidad neta': 'Diferencia entre los ingresos y gastos registrados en este ejemplo. No equivale al saldo disponible en el banco.',
};
export default function ProductDemo() {
 const [metric,setMetric] = useState('Ingresos');
 const [month,setMonth] = useState(3);
 const totalIngresos = income.slice(0,month+1).reduce((a,b)=>a+b,0);
 const totalGastos = expenses.slice(0,month+1).reduce((a,b)=>a+b,0);
 return <section className="cg-demo" aria-label="Demostración del dashboard con datos de ejemplo"><div className="cg-demo-top"><div><span className="cg-demo-dot" /> Finca de ejemplo <span className="cg-demo-label">Demostración</span></div><label>Período <select value={month} onChange={e=>setMonth(Number(e.target.value))}>{months.map((m,i)=><option key={m} value={i}>Enero – {m}</option>)}</select></label></div><div className="cg-demo-body"><div className="cg-demo-heading"><div><h2>El pulso de tu finca</h2><p>Resumen financiero</p></div><span className="cg-note">Datos sintéticos · CRC</span></div><ResumenCards resumen={{totalIngresos,totalGastos,ivaAPagar:18500,utilidadNeta:totalIngresos-totalGastos}} /><div className="cg-demo-columns"><div><h3>Ingresos vs. gastos mensuales</h3><div className="cg-chart-legend"><span>● Ingresos</span><span>● Gastos</span></div><div className="cg-bars" role="img" aria-label="Comparación mensual de ingresos y gastos; valores disponibles en la tabla inferior">{months.slice(0,month+1).map((m,i)=><div className="cg-bar-group" key={m}><div className="cg-bar-pair"><span style={{height:`${income[i]/12000}px`}}/><span style={{height:`${expenses[i]/12000}px`}}/></div><span>{m.slice(0,3)}</span></div>)}</div><details className="cg-chart-table"><summary>Consultar valores del gráfico</summary><table><caption>Datos sintéticos en colones</caption><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th></tr></thead><tbody>{months.slice(0,month+1).map((m,i)=><tr key={m}><th>{m}</th><td>{income[i].toLocaleString('es-CR')}</td><td>{expenses[i].toLocaleString('es-CR')}</td></tr>)}</tbody></table></details></div><aside className="cg-demo-explainer"><h3>¿Qué te cuenta cada indicador?</h3><div className="cg-metric-buttons">{Object.keys(explanations).map(label=><button key={label} aria-pressed={metric===label} onClick={()=>setMetric(label)}>{label}</button>)}</div><p aria-live="polite">{explanations[metric]}</p></aside></div><p className="cg-note">Tarjetas del dashboard real con datos de ejemplo. Sin conexión a cuentas privadas. IVA ilustrativo fijo.</p></div></section>;
}
