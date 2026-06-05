import { useState, useEffect, useCallback } from 'react';
import { obtenerInventarioAPI, obtenerResumenInventarioAPI } from '../services/api';
import './InventarioPage.css';

export default function InventarioPage() {
  const [inventario, setInventario] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tabActiva, setTabActiva] = useState('bovinos');

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [invRes, resumenRes] = await Promise.all([
        obtenerInventarioAPI(),
        obtenerResumenInventarioAPI(),
      ]);
      setInventario(invRes.data);
      setResumen(resumenRes.data);
    } catch {
      setError('Error cargando inventario');
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

  const tabs = [
    { id: 'bovinos', label: 'Bovinos', count: resumen?.totalBovinos || 0 },
    { id: 'aves', label: 'Aves', count: resumen?.totalAves || 0 },
    { id: 'peces', label: 'Peces', count: resumen?.totalPeces || 0 },
    { id: 'colmenas', label: 'Colmenas', count: inventario?.colmenas?.filter(c => c.activo).length || 0 },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario Agropecuario</h1>
          <p className="page-subtitle">Control integral de bovinos, aves, peces y colmenas</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="dashboard-cards">
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--green"><span>🐄</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Bovinos Activos</span>
            <span className="dash-card-value">{resumen?.totalBovinos || 0}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--amber"><span>🐔</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Aves en Producción</span>
            <span className="dash-card-value">{resumen?.totalAves || 0}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--blue"><span>🐟</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Biomasa Peces (kg)</span>
            <span className="dash-card-value">{resumen?.totalBiomasa?.toLocaleString() || 0}</span>
          </div>
        </div>
        <div className="glass-card dash-card">
          <div className="dash-card-icon dash-card-icon--green"><span>🍯</span></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Miel Producida (kg)</span>
            <span className="dash-card-value">{resumen?.totalMiel?.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="inv-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`inv-tab ${tabActiva === tab.id ? 'inv-tab--activo' : ''}`}
            onClick={() => setTabActiva(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Contenido por tab */}
      <div className="inv-tab-content">
        {tabActiva === 'bovinos' && (
          <div>
            <h2 className="chart-title">Bovinos</h2>
            {inventario?.bovinos?.filter(b => b.activo).length === 0 ? (
              <p className="text-muted">No hay bovinos registrados.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>Tag</th><th>Nombre</th><th>Tipo</th><th>Raza</th><th>Peso (kg)</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {inventario.bovinos.filter(b => b.activo).map(b => (
                      <tr key={b._id}>
                        <td>{b.tagId}</td>
                        <td>{b.nombre || '-'}</td>
                        <td>{b.tipo}</td>
                        <td>{b.raza || '-'}</td>
                        <td>{b.pesoActualKg}</td>
                        <td><span className={`badge badge-${b.estadoSanitario === 'sano' ? 'exito' : 'advertencia'}`}>{b.estadoSanitario}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tabActiva === 'aves' && (
          <div>
            <h2 className="chart-title">Lotes de Aves</h2>
            {inventario?.lotesAves?.filter(l => l.activo).length === 0 ? (
              <p className="text-muted">No hay lotes de aves registrados.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>Lote</th><th>Especie</th><th>Galpón</th><th>Aves Actuales</th><th>Huevos/Cartones</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {inventario.lotesAves.filter(l => l.activo).map(l => (
                      <tr key={l._id}>
                        <td>{l.loteId}</td>
                        <td>{l.especie}</td>
                        <td>{l.galpon || '-'}</td>
                        <td>{l.cicloActual?.nActualAves || 0}</td>
                        <td>{l.totalHuevosProducidos || 0} / {l.totalCartonesProducidos || 0}</td>
                        <td>{l.cicloActual?.estado || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tabActiva === 'peces' && (
          <div>
            <h2 className="chart-title">Estanques</h2>
            {inventario?.estanques?.filter(e => e.activo).length === 0 ? (
              <p className="text-muted">No hay estanques registrados.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>Estanque</th><th>Especie</th><th>Capacidad (m³)</th><th>Peces</th><th>Biomasa (kg)</th><th>FCA</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {inventario.estanques.filter(e => e.activo).map(e => (
                      <tr key={e._id}>
                        <td>{e.estanqueId}</td>
                        <td>{e.especie}</td>
                        <td>{e.capacidadM3}</td>
                        <td>{e.nActual}</td>
                        <td>{e.biomasaTotalKg?.toLocaleString()}</td>
                        <td>{e.tasaConversionAlimenticia?.toFixed(2) || '-'}</td>
                        <td>{e.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tabActiva === 'colmenas' && (
          <div>
            <h2 className="chart-title">Colmenas</h2>
            {inventario?.colmenas?.filter(c => c.activo).length === 0 ? (
              <p className="text-muted">No hay colmenas registradas.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>Colmena</th><th>Especie</th><th>Ubicación</th><th>Estado</th><th>Miel (kg)</th><th>Extracciones</th></tr>
                  </thead>
                  <tbody>
                    {inventario.colmenas.filter(c => c.activo).map(c => (
                      <tr key={c._id}>
                        <td>{c.colmenaId}</td>
                        <td>{c.especie}</td>
                        <td>{c.ubicacion || '-'}</td>
                        <td>{c.estadoColonia}</td>
                        <td>{c.mielProducidaTotalKg}</td>
                        <td>{c.extracciones?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
