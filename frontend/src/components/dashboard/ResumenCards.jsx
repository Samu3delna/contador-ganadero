import { TrendingUp, TrendingDown, DollarSign, Receipt } from 'lucide-react';

const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

export default function ResumenCards({ resumen }) {
  const r = resumen || {};

  return (
    <div className="dashboard-cards">
      <div className="dash-card glass-card animate-slide-up" style={{ '--delay': '0s' }}>
        <div className="dash-card-icon dash-card-icon--green"><TrendingUp size={22} /></div>
        <div className="dash-card-info">
          <span className="dash-card-label">Ingresos</span>
          <span className="dash-card-value text-mono">{formatCRC(r.totalIngresos)}</span>
        </div>
      </div>
      <div className="dash-card glass-card animate-slide-up" style={{ '--delay': '0.1s' }}>
        <div className="dash-card-icon dash-card-icon--red"><TrendingDown size={22} /></div>
        <div className="dash-card-info">
          <span className="dash-card-label">Gastos</span>
          <span className="dash-card-value text-mono">{formatCRC(r.totalGastos)}</span>
        </div>
      </div>
      <div className="dash-card glass-card animate-slide-up" style={{ '--delay': '0.2s' }}>
        <div className="dash-card-icon dash-card-icon--amber"><Receipt size={22} /></div>
        <div className="dash-card-info">
          <span className="dash-card-label">IVA Cuatrimestre</span>
          <span className="dash-card-value text-mono">
            {(r.ivaAPagar || 0) > 0 ? formatCRC(r.ivaAPagar) : (r.ivaCredito || 0) > 0 ? `Crédito ${formatCRC(r.ivaCredito)}` : formatCRC(0)}
          </span>
        </div>
      </div>
      <div className="dash-card glass-card animate-slide-up" style={{ '--delay': '0.3s' }}>
        <div className="dash-card-icon dash-card-icon--blue"><DollarSign size={22} /></div>
        <div className="dash-card-info">
          <span className="dash-card-label">Utilidad Neta</span>
          <span className="dash-card-value text-mono">{formatCRC(r.utilidadNeta)}</span>
        </div>
      </div>
    </div>
  );
}
