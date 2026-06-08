import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { resumenDashboardAPI, tendenciaMensualAPI, gastosPorCategoriaAPI, sincronizarEmailAPI, sincronizarEmailCompletoAPI, estadoEmailAPI } from '../services/api';
import ResumenCards from '../components/dashboard/ResumenCards';
import TendenciaChart from '../components/dashboard/TendenciaChart';
import GastosCategoriaList from '../components/dashboard/GastosCategoriaList';
import ProyeccionFiscal from '../components/dashboard/ProyeccionFiscal';
import './DashboardPage.css';

async function cargarData() {
  const [res, tend, cat] = await Promise.all([
    resumenDashboardAPI(), tendenciaMensualAPI(), gastosPorCategoriaAPI()
  ]);
  return {
    resumen: res.data,
    tendencia: tend.data,
    categorias: cat.data,
  };
}

export default function DashboardPage() {
  const [resumen, setResumen] = useState(null);
  const [tendencia, setTendencia] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [modoSync, setModoSync] = useState('rapido'); // 'rapido' | 'completo'
  const [estadoEmail, setEstadoEmail] = useState(null);
  const [ultimoResultado, setUltimoResultado] = useState(null);

  useEffect(() => {
    let activo = true;
    cargarData()
      .then((data) => {
        if (activo) {
          setResumen(data.resumen);
          setTendencia(data.tendencia);
          setCategorias(data.categorias);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (activo) {
          setCargando(false);
        }
      });
    // Cargar estado del email
    estadoEmailAPI().then(r => { if (activo) setEstadoEmail(r.data); }).catch(() => {});
    return () => { activo = false; };
  }, []);

  async function handleSincronizar() {
    setSincronizando(true);
    try {
      const fn = modoSync === 'rapido' ? sincronizarEmailAPI : sincronizarEmailCompletoAPI;
      const resultado = await fn(true); // true = solo no leidos para rápido
      setUltimoResultado(resultado.data);
      // Refrescar datos
      const data = await cargarData();
      setResumen(data.resumen);
      setTendencia(data.tendencia);
      setCategorias(data.categorias);
      // Actualizar estado email
      const est = await estadoEmailAPI();
      setEstadoEmail(est.data);
    } catch (err) {
      console.error(err);
      alert('Error al sincronizar correos: ' + (err.response?.data?.error || err.message));
    } finally {
      setSincronizando(false);
    }
  }

  if (cargando) return <div className="page-content"><div className="loader-center"><div className="loader" /></div></div>;

  const hayIngresos = tendencia.some(t => t.ingresos > 0);
  const alertaIngresos = !hayIngresos && resumen?.resumen?.totalGastos > 0;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen financiero — Período {resumen?.periodoFiscal || new Date().getFullYear()}</p>
        </div>
        <div className="dashboard-actions">
          <div className="sync-buttons">
            <button
              className={`btn ${modoSync === 'rapido' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setModoSync('rapido')}
              disabled={sincronizando}
              title="Solo emails no leídos (~10-15s)"
            >
              Rápido (No leídos)
            </button>
            <button
              className={`btn ${modoSync === 'completo' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setModoSync('completo')}
              disabled={sincronizando}
              title="Todos los emails últimos 60 días (~2-3 min)"
            >
              Completo (Todos)
            </button>
            <button
              id="btn-sincronizar-dashboard"
              className="btn btn-primary btn-sync-main"
              onClick={handleSincronizar}
              disabled={sincronizando}
            >
              {sincronizando ? (
                <>
                  <Loader2 size={18} className="spin" />
                  {modoSync === 'rapido' ? 'Leyendo no leídos...' : 'Leyendo TODOS...'}
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Leer Correos
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {alertaIngresos && (
        <div className="alerta-ingresos">
          <AlertCircle size={20} />
          <span>No hay ingresos registrados. Ve a <strong>Ingresos</strong> para agregar ventas de ganado/leche.</span>
        </div>
      )}

      {ultimoResultado && (
        <div className="sync-resultado">
          <CheckCircle size={20} />
          <span>
            ✅ Sincronizado: {ultimoResultado.estadisticas?.emailsProcesados || 0} emails, 
            {ultimoResultado.estadisticas?.facturasCreadas || 0} facturas nuevas,
            {ultimoResultado.estadisticas?.xmlsDescargados || 0} XMLs
          </span>
        </div>
      )}

      <ResumenCards resumen={resumen?.resumen} />
      
      <TendenciaChart tendencia={tendencia} />

      <div className="dashboard-bottom-row">
        <GastosCategoriaList categorias={categorias} />
        <ProyeccionFiscal resumen={resumen} />
      </div>
    </div>
  );
}
