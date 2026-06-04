import { useState, useEffect } from 'react';
import { obtenerCostosAPI, obtenerResumenCostosAPI } from '../services/api';

export default function CostosPage() {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const resumenRes = await obtenerResumenCostosAPI();
      setResumen(resumenRes.data);
    } catch {
      setError('Error cargando costos de producción');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  if (cargando) return <div className="loader-center"><div className="loader" /></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="page-container">
      <h1 className="page-title">Control de Costos de Producción</h1>

      {/* Resumen Global */}
      <div className="cards-grid">
        <div className="card">
          <h3>Costo Total Insumos</h3>
          <p className="big-number">₡{resumen?.resumenGlobal?.costoTotalInsumos?.toLocaleString() || 0}</p>
        </div>
        <div className="card">
          <h3>Ingreso Total Ventas</h3>
          <p className="big-number">₡{resumen?.resumenGlobal?.ingresoTotalVentas?.toLocaleString() || 0}</p>
        </div>
        <div className="card">
          <h3>Margen Operativo</h3>
          <p className={`big-number ${(resumen?.resumenGlobal?.margenOperativoGlobal || 0) >= 0 ? 'positivo' : 'negativo'}`}>
            ₡{resumen?.resumenGlobal?.margenOperativoGlobal?.toLocaleString() || 0}
          </p>
        </div>
        <div className="card">
          <h3>Costo Promedio / kg</h3>
          <p className="big-number">₡{resumen?.resumenGlobal?.costoPromedioPorKg?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Centros de Costo */}
      <h2 className="section-title">Centros de Costo</h2>
      {resumen?.centrosCosto?.length === 0 ? (
        <p>No hay centros de costo registrados.</p>
      ) : (
        <div className="table-container">
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
                  <td>{c.activo ? 'Activo' : 'Cerrado'}</td>
                  <td>₡{c.indicadores?.costoProduccionPorKg?.toLocaleString() || 0}</td>
                  <td>{c.indicadores?.factorConversionAlimenticia?.toFixed(2) || '-'}</td>
                  <td>₡{c.indicadores?.ingresoTotalVentas?.toLocaleString() || 0}</td>
                  <td className={c.indicadores?.margenRentaOperativa >= 0 ? 'positivo' : 'negativo'}>
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
