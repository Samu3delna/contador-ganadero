import { useState, useEffect, useCallback } from 'react';
import { obtenerResumenCostosAPI } from '../services/api';
import './CostosPage.css';

export default function CostosPage() {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const resumenRes = await obtenerResumenCostosAPI();
      setResumen(resumenRes.data);
    } catch {
      setError('Error cargando costos de producción');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  if (cargando) return <div className="loader-center"><div className="loader" /></div>;
  if (error) return <div className="error-message">{error}</div>;

  const margen = resumen?.resumenGlobal?.margenOperativoGlobal || 0;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Control de Costos de Producción</h1>
          <p className="page-subtitle">KPIs por centro de costo y rentabilidad</p>
        </div>
      </div>

      {/* Resumen Global */}
      <div className="dashboard-cards">
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--red"><span>💰</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Costo Total Insumos</span>
            <span className="dash-card-value">₡{resumen?.resumenGlobal?.costoTotalInsumos?.toLocaleString() || 0}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--green"><span>💵</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Ingreso Total Ventas</span>
            <span className="dash-card-value">₡{resumen?.resumenGlobal?.ingresoTotalVentas?.toLocaleString() || 0}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className={`dash-card-icon ${margen >= 0 ? 'dash-card-icon--green' : 'dash-card-icon--red'}`}><span>📊</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Margen Operativo</span>
            <span className="dash-card-value">₡{margen.toLocaleString()}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--blue"><span>⚖️</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Costo Promedio / kg</span>
            <span className="dash-card-value">₡{resumen?.resumenGlobal?.costoPromedioPorKg?.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Centros de Costo */}
      <h2 className="chart-title">Centros de Costo</h2>
      {resumen?.centrosCosto?.length === 0 ? (
        <p className="text-muted">No hay centros de costo registrados.</p>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Actividad</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Costo/kg</th>
                <th>FCA</th>
                <th>Ingresos</th>
                <th>Margen</th>
              </tr>
            </thead>
            <tbody>
              {resumen.centrosCosto.map(c => (
                <tr key={c.referenciaId}>
                  <td>{c.referenciaId}</td>
                  <td>{c.tipoActividad}</td>
                  <td>{c.nombreLote || '-'}</td>
                  <td><span className={`badge badge-${c.activo ? 'exito' : 'advertencia'}`}>{c.activo ? 'Activo' : 'Cerrado'}</span></td>
                  <td>₡{c.indicadores?.costoProduccionPorKg?.toLocaleString() || 0}</td>
                  <td>{c.indicadores?.factorConversionAlimenticia?.toFixed(2) || '-'}</td>
                  <td>₡{c.indicadores?.ingresoTotalVentas?.toLocaleString() || 0}</td>
                  <td className={c.indicadores?.margenRentaOperativa >= 0 ? 'text-exito' : 'text-error'}>
                    ₡{c.indicadores?.margenRentaOperativa?.toLocaleString() || 0}
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
