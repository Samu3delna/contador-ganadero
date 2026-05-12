import { AlertTriangle, ArrowUpRight } from 'lucide-react';

const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

export default function ProyeccionFiscal({ resumen }) {
  const r = resumen?.resumen || {};

  return (
    <div className="glass-card animate-slide-up" style={{ '--delay': '0.6s' }}>
      <h3 className="chart-title">Proyección Fiscal</h3>
      <div className="proyeccion-items">
        <div className="proyeccion-item">
          <div className="proyeccion-label">
            <AlertTriangle size={16} className="proyeccion-icon" />
            <span>Renta Anual Estimada</span>
          </div>
          <span className="proyeccion-valor text-mono">
            {formatCRC(resumen?.rentaProyectada?.impuestoFinal || 0)}
          </span>
          {(resumen?.rentaProyectada?.impuestoFinal || 0) === 0 && (
            <span className="badge badge-exito">Exento</span>
          )}
        </div>
        <div className="proyeccion-item">
          <div className="proyeccion-label">
            <ArrowUpRight size={16} className="proyeccion-icon" />
            <span>IVA Cuatrimestre Actual</span>
          </div>
          <span className="proyeccion-valor text-mono">
            {(r.ivaAPagar || 0) > 0 ? formatCRC(r.ivaAPagar) : `Crédito ${formatCRC(r.ivaCredito || 0)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
