import { useState, useEffect } from 'react';
import { obtenerInventarioAPI, obtenerResumenInventarioAPI } from '../services/api';

export default function InventarioPage() {
  const [inventario, setInventario] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tabActiva, setTabActiva] = useState('bovinos');

  const cargarDatos = async () => {
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
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  if (cargando) return <div className="loader-center"><div className="loader" /></div>;
  if (error) return <div className="error-message">{error}</div>;

  const tabs = [
    { id: 'bovinos', label: 'Bovinos', count: resumen?.totalBovinos || 0 },
    { id: 'aves', label: 'Aves', count: resumen?.totalAves || 0 },
    { id: 'peces', label: 'Peces', count: resumen?.totalPeces || 0 },
    { id: 'colmenas', label: 'Colmenas', count: inventario?.colmenas?.filter(c => c.activo).length || 0 },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">Inventario Agropecuario</h1>

      {/* Resumen */}
      <div className="cards-grid">
        <div className="card">
          <h3>Bovinos Activos</h3>
          <p className="big-number">{resumen?.totalBovinos || 0}</p>
        </div>
        <div className="card">
          <h3>Aves en Producción</h3>
          <p className="big-number">{resumen?.totalAves || 0}</p>
        </div>
        <div className="card">
          <h3>Biomasa Peces (kg)</h3>
          <p className="big-number">{resumen?.totalBiomasa?.toLocaleString() || 0}</p>
        </div>
        <div className="card">
          <h3>Miel Producida (kg)</h3>
          <p className="big-number">{resumen?.totalMiel?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${tabActiva === tab.id ? 'tab--activo' : ''}`}
            onClick={() => setTabActiva(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Contenido por tab */}
      <div className="tab-content">
        {tabActiva === 'bovinos' && (
          <div>
            <h2>Bovinos</h2>
            {inventario?.bovinos?.filter(b => b.activo).length === 0 ? (
              <p>No hay bovinos registrados.</p>
            ) : (
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
                      <td>{b.estadoSanitario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tabActiva === 'aves' && (
          <div>
            <h2>Lotes de Aves</h2>
            {inventario?.lotesAves?.filter(l => l.activo).length === 0 ? (
              <p>No hay lotes de aves registrados.</p>
            ) : (
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
            )}
          </div>
        )}

        {tabActiva === 'peces' && (
          <div>
            <h2>Estanques</h2>
            {inventario?.estanques?.filter(e => e.activo).length === 0 ? (
              <p>No hay estanques registrados.</p>
            ) : (
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
            )}
          </div>
        )}

        {tabActiva === 'colmenas' && (
          <div>
            <h2>Colmenas</h2>
            {inventario?.colmenas?.filter(c => c.activo).length === 0 ? (
              <p>No hay colmenas registradas.</p>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
