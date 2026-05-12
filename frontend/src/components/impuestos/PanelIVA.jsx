const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

export default function PanelIVA({ iva, CUATRIMESTRE_LABEL, cuatrimestre, anio }) {
  if (!iva) return null;

  return (
    <div className="glass-card impuesto-resultado animate-slide-up">
      <h3>Resultado IVA — {CUATRIMESTRE_LABEL[cuatrimestre]} {anio}</h3>
      <div className="impuesto-grid">
        <div className="impuesto-item">
          <span className="impuesto-label">IVA Cobrado (Ventas)</span>
          <span className="impuesto-valor text-mono" style={{color:'var(--color-exito)'}}>{formatCRC(iva.ivaCobrado)}</span>
        </div>
        <div className="impuesto-item">
          <span className="impuesto-label">IVA Pagado (Compras)</span>
          <span className="impuesto-valor text-mono" style={{color:'var(--color-error)'}}>{formatCRC(iva.ivaPagado)}</span>
        </div>
        <div className="impuesto-item impuesto-item--resultado">
          <span className="impuesto-label">{iva.aPagar ? 'A Pagar a Hacienda' : 'Crédito Fiscal a Favor'}</span>
          <span className={`impuesto-valor-grande text-mono ${iva.aPagar?'text-error':'text-success'}`}>
            {formatCRC(Math.abs(iva.ivaResultante))}
          </span>
        </div>
      </div>
      {iva.detalleIVAPorTasa?.length > 0 && (
        <div className="impuesto-detalle">
          <h4>Desglose por Tasa de IVA</h4>
          <table className="tabla"><thead><tr><th>Tasa</th><th>Base Pagada</th><th>IVA Pagado</th><th>Base Cobrada</th><th>IVA Cobrado</th></tr></thead>
            <tbody>{iva.detalleIVAPorTasa.map((d,i)=>(
              <tr key={i}><td>{d.tasa}%</td><td className="text-mono">{formatCRC(d.basePagada)}</td><td className="text-mono">{formatCRC(d.ivaPagado)}</td><td className="text-mono">{formatCRC(d.baseCobrada)}</td><td className="text-mono">{formatCRC(d.ivaCobrado)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
