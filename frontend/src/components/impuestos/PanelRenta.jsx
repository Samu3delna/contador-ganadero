const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

export default function PanelRenta({ renta, anio }) {
  if (!renta) return null;

  return (
    <div className="glass-card impuesto-resultado animate-slide-up">
      <h3>Impuesto sobre la Renta — Año {anio}</h3>
      <div className="impuesto-grid">
        <div className="impuesto-item"><span className="impuesto-label">Ingresos Brutos</span><span className="impuesto-valor text-mono">{formatCRC(renta.ingresosBrutos)}</span></div>
        <div className="impuesto-item"><span className="impuesto-label">Gastos Deducibles</span><span className="impuesto-valor text-mono">{formatCRC(renta.gastosDeducibles)}</span></div>
        <div className="impuesto-item"><span className="impuesto-label">Utilidad Neta</span><span className="impuesto-valor text-mono" style={{fontWeight:700}}>{formatCRC(renta.utilidadNeta)}</span></div>
        <div className="impuesto-item"><span className="impuesto-label">Monto Exento</span><span className="impuesto-valor text-mono">{formatCRC(renta.montoExento)}</span></div>
      </div>
      {renta.detalleTramos?.length > 0 && (
        <div className="impuesto-detalle">
          <h4>Desglose por Tramos</h4>
          <table className="tabla"><thead><tr><th>Desde</th><th>Hasta</th><th>Tasa</th><th>Impuesto</th></tr></thead>
            <tbody>{renta.detalleTramos.map((t,i)=>(
              <tr key={i}><td className="text-mono">{formatCRC(t.desde)}</td><td className="text-mono">{formatCRC(t.hasta)}</td><td>{t.tasa}%</td><td className="text-mono">{formatCRC(t.impuesto)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="impuesto-grid" style={{marginTop:'var(--espacio-lg)'}}>
        <div className="impuesto-item"><span className="impuesto-label">Créditos Fiscales</span><span className="impuesto-valor text-mono">{formatCRC(renta.creditosFiscales?.total)}</span></div>
        <div className="impuesto-item impuesto-item--resultado">
          <span className="impuesto-label">Impuesto Final a Pagar</span>
          <span className={`impuesto-valor-grande text-mono ${renta.impuestoFinal > 0 ? 'text-error':'text-success'}`}>{formatCRC(renta.impuestoFinal)}</span>
          {renta.impuestoFinal === 0 && <span className="badge badge-exito">Exento</span>}
        </div>
      </div>
    </div>
  );
}
