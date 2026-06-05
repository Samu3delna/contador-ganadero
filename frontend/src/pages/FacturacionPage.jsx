import { useState, useEffect, useCallback } from 'react';
import { obtenerFacturasEmisionAPI, obtenerResumenEmisionAPI } from '../services/api';
import './FacturacionPage.css';

export default function FacturacionPage() {
  const [facturas, setFacturas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [facturasRes, resumenRes] = await Promise.all([
        obtenerFacturasEmisionAPI(),
        obtenerResumenEmisionAPI(),
      ]);
      setFacturas(facturasRes.data.facturas || []);
      setResumen(resumenRes.data);
    } catch {
      setError('Error cargando facturación');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  const estadoBadge = (estado) => {
    const map = {
      borrador: 'badge-advertencia',
      generada: 'badge-info',
      firmada: 'badge-primario',
      enviada_hacienda: 'badge-advertencia',
      aceptada: 'badge-exito',
      rechazada: 'badge-error',
      anulada: 'badge-secundario',
    };
    return map[estado] || 'badge-advertencia';
  };

  if (cargando) return <div className="loader-center"><div className="loader" /></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturación Electrónica REA</h1>
          <p className="page-subtitle">Emisión de facturas con tarifa reducida del 1% de IVA</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="dashboard-cards">
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--blue"><span>📄</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Total Facturas</span>
            <span className="dash-card-value">{resumen?.totalFacturas || 0}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--green"><span>💵</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Total Emitido</span>
            <span className="dash-card-value">₡{resumen?.totalEmitido?.toLocaleString() || 0}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--amber"><span>📉</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">IVA Recaudado (1%)</span>
            <span className="dash-card-value">₡{resumen?.totalIVARecaudado?.toLocaleString() || 0}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--green"><span>✅</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Aceptadas</span>
            <span className="dash-card-value">{resumen?.porEstado?.aceptada || 0}</span>
          </div>
        </div>
      </div>

      {/* Lista de facturas */}
      <h2 className="chart-title">Facturas Emitidas</h2>
      {facturas.length === 0 ? (
        <p className="text-muted">No hay facturas emitidas.</p>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Consecutivo</th>
                <th>Receptor</th>
                <th>Producto</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>IVA (1%)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr key={f._id}>
                  <td>{f.consecutivo}</td>
                  <td>{f.receptor?.nombre}</td>
                  <td>{f.tipoProducto}</td>
                  <td>{new Date(f.fechaEmision).toLocaleDateString('es-CR')}</td>
                  <td>₡{f.resumenFactura?.totalComprobante?.toLocaleString()}</td>
                  <td>₡{f.resumenFactura?.totalImpuesto?.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${estadoBadge(f.estado)}`}>
                      {f.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
