import { useState, useEffect, useCallback } from 'react';
import { Edit3, Trash2, Plus, AlertTriangle } from 'lucide-react';
import {
  obtenerInventarioAPI,
  obtenerResumenInventarioAPI,
  agregarBovinoAPI,
  actualizarBovinoAPI,
  eliminarBovinoAPI,
  agregarLoteAvesAPI,
  actualizarLoteAvesAPI,
  eliminarLoteAvesAPI,
  agregarEstanqueAPI,
  actualizarEstanqueAPI,
  eliminarEstanqueAPI,
  agregarColmenaAPI,
  actualizarColmenaAPI,
  eliminarColmenaAPI
} from '../services/api';
import { toast } from 'react-hot-toast';
import Modal from '../components/common/Modal';
import BovinoForm from '../components/inventario/BovinoForm';
import AvesForm from '../components/inventario/AvesForm';
import PecesForm from '../components/inventario/PecesForm';
import ColmenaForm from '../components/inventario/ColmenaForm';
import './InventarioPage.css';

export default function InventarioPage() {
  const [inventario, setInventario] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tabActiva, setTabActiva] = useState('bovinos');

  // Control del modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [elementoEdicion, setElementoEdicion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // { id, tipo }

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [invRes, resumenRes] = await Promise.all([
        obtenerInventarioAPI(),
        obtenerResumenInventarioAPI(),
      ]);
      setInventario(invRes.data);
      setResumen(resumenRes.data);
    } catch (err) {
      console.error(err);
      setError('Error cargando inventario');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  const handleGuardar = async (datos) => {
    setGuardando(true);
    try {
      if (tabActiva === 'bovinos') {
        if (elementoEdicion) {
          await actualizarBovinoAPI(elementoEdicion._id, datos);
          toast.success('Bovino actualizado correctamente');
        } else {
          await agregarBovinoAPI(datos);
          toast.success('Bovino registrado correctamente');
        }
      } else if (tabActiva === 'aves') {
        if (elementoEdicion) {
          await actualizarLoteAvesAPI(elementoEdicion._id, datos);
          toast.success('Lote de aves actualizado');
        } else {
          await agregarLoteAvesAPI(datos);
          toast.success('Lote de aves registrado');
        }
      } else if (tabActiva === 'peces') {
        if (elementoEdicion) {
          await actualizarEstanqueAPI(elementoEdicion._id, datos);
          toast.success('Estanque actualizado');
        } else {
          await agregarEstanqueAPI(datos);
          toast.success('Estanque registrado');
        }
      } else if (tabActiva === 'colmenas') {
        if (elementoEdicion) {
          await actualizarColmenaAPI(elementoEdicion._id, datos);
          toast.success('Colmena actualizada');
        } else {
          await agregarColmenaAPI(datos);
          toast.success('Colmena registrada');
        }
      }
      setModalAbierto(false);
      setElementoEdicion(null);
      await cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = (id) => {
    setConfirmarEliminar({ id, tipo: tabActiva });
  };

  const confirmarEliminarAccion = async () => {
    if (!confirmarEliminar) return;
    const { id, tipo } = confirmarEliminar;
    try {
      if (tipo === 'bovinos') {
        await eliminarBovinoAPI(id);
        toast.success('Bovino eliminado');
      } else if (tipo === 'aves') {
        await eliminarLoteAvesAPI(id);
        toast.success('Lote de aves eliminado');
      } else if (tipo === 'peces') {
        await eliminarEstanqueAPI(id);
        toast.success('Estanque eliminado');
      } else if (tipo === 'colmenas') {
        await eliminarColmenaAPI(id);
        toast.success('Colmena eliminada');
      }
      await cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar el elemento');
    } finally {
      setConfirmarEliminar(null);
    }
  };

  const abrirRegistro = () => {
    setElementoEdicion(null);
    setModalAbierto(true);
  };

  const abrirEdicion = (elemento) => {
    setElementoEdicion(elemento);
    setModalAbierto(true);
  };

  if (cargando) return <div className="loader-center"><div className="loader" /></div>;
  if (error) return <div className="error-message">{error}</div>;

  const tabs = [
    { id: 'bovinos', label: 'Bovinos', count: resumen?.totalBovinos || 0 },
    { id: 'aves', label: 'Aves', count: resumen?.totalAves || 0 },
    { id: 'peces', label: 'Peces', count: resumen?.totalPeces || 0 },
    { id: 'colmenas', label: 'Colmenas', count: inventario?.colmenas?.filter(c => c.activo).length || 0 },
  ];

  const renderFormulario = () => {
    switch (tabActiva) {
      case 'bovinos':
        return <BovinoForm animal={elementoEdicion} onSave={handleGuardar} onCancel={() => setModalAbierto(false)} guardando={guardando} />;
      case 'aves':
        return <AvesForm animal={elementoEdicion} onSave={handleGuardar} onCancel={() => setModalAbierto(false)} guardando={guardando} />;
      case 'peces':
        return <PecesForm animal={elementoEdicion} onSave={handleGuardar} onCancel={() => setModalAbierto(false)} guardando={guardando} />;
      case 'colmenas':
        return <ColmenaForm animal={elementoEdicion} onSave={handleGuardar} onCancel={() => setModalAbierto(false)} guardando={guardando} />;
      default:
        return null;
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario Agropecuario</h1>
          <p className="page-subtitle">Control integral de bovinos, aves, peces y colmenas</p>
        </div>
        <button className="btn btn-primary" onClick={abrirRegistro}>
          <Plus size={18} /> Registrar {tabActiva === 'bovinos' ? 'Bovino' : tabActiva === 'aves' ? 'Lote de Aves' : tabActiva === 'peces' ? 'Estanque' : 'Colmena'}
        </button>
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
                    <tr>
                      <th>Tag</th>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Raza</th>
                      <th>Peso (kg)</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
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
                        <td>
                          <div className="acciones-cell" style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-icon" onClick={() => abrirEdicion(b)} title="Editar"><Edit3 size={16} /></button>
                            <button className="btn-icon" onClick={() => handleEliminar(b._id)} title="Eliminar"><Trash2 size={16} /></button>
                          </div>
                        </td>
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
                    <tr>
                      <th>Lote</th>
                      <th>Especie</th>
                      <th>Galpón</th>
                      <th>Aves Actuales</th>
                      <th>Huevos/Cartones</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
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
                        <td>
                          <div className="acciones-cell" style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-icon" onClick={() => abrirEdicion(l)} title="Editar"><Edit3 size={16} /></button>
                            <button className="btn-icon" onClick={() => handleEliminar(l._id)} title="Eliminar"><Trash2 size={16} /></button>
                          </div>
                        </td>
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
                    <tr>
                      <th>Estanque</th>
                      <th>Especie</th>
                      <th>Capacidad (m³)</th>
                      <th>Peces</th>
                      <th>Biomasa (kg)</th>
                      <th>FCA</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
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
                        <td>
                          <div className="acciones-cell" style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-icon" onClick={() => abrirEdicion(e)} title="Editar"><Edit3 size={16} /></button>
                            <button className="btn-icon" onClick={() => handleEliminar(e._id)} title="Eliminar"><Trash2 size={16} /></button>
                          </div>
                        </td>
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
                    <tr>
                      <th>Colmena</th>
                      <th>Especie</th>
                      <th>Ubicación</th>
                      <th>Estado</th>
                      <th>Miel (kg)</th>
                      <th>Extracciones</th>
                      <th>Acciones</th>
                    </tr>
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
                        <td>
                          <div className="acciones-cell" style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-icon" onClick={() => abrirEdicion(c)} title="Editar"><Edit3 size={16} /></button>
                            <button className="btn-icon" onClick={() => handleEliminar(c._id)} title="Eliminar"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={`${elementoEdicion ? 'Editar' : 'Registrar'} ${
          tabActiva === 'bovinos' ? 'Bovino' : tabActiva === 'aves' ? 'Lote de Aves' : tabActiva === 'peces' ? 'Estanque' : 'Colmena'
        }`}
        size="lg"
      >
        {renderFormulario()}
      </Modal>

      {confirmarEliminar && (
        <Modal
          isOpen
          onClose={() => setConfirmarEliminar(null)}
          title="Confirmar Eliminación"
          size="sm"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <AlertTriangle size={28} style={{ color: 'var(--color-advertencia)' }} />
            <span>¿Está seguro de que desea eliminar este elemento? Esta acción no se puede deshacer.</span>
          </div>
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={confirmarEliminarAccion}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
