import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { resumenDashboardAPI, tendenciaMensualAPI, gastosPorCategoriaAPI, sincronizarEmailAPI } from '../services/api';
import ResumenCards from '../components/dashboard/ResumenCards';
import TendenciaChart from '../components/dashboard/TendenciaChart';
import GastosCategoriaList from '../components/dashboard/GastosCategoriaList';
import ProyeccionFiscal from '../components/dashboard/ProyeccionFiscal';
import './DashboardPage.css';

export default function DashboardPage() {
  const [resumen, setResumen] = useState(null);
  const [tendencia, setTendencia] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const cargar = useCallback(async (mostrarLoader = true) => {
    if (mostrarLoader) setCargando(true);
    try {
      const [res, tend, cat] = await Promise.all([
        resumenDashboardAPI(), tendenciaMensualAPI(), gastosPorCategoriaAPI()
      ]);
      setResumen(res.data);
      setTendencia(tend.data);
      setCategorias(cat.data);
    } catch (err) { console.error(err); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => {
    cargar(true);
  }, [cargar]);

  async function handleSincronizar() {
    setSincronizando(true);
    try {
      await sincronizarEmailAPI();
      await cargar(false);
    } catch (err) {
      console.error(err);
      alert('Error al sincronizar correos');
    } finally {
      setSincronizando(false);
    }
  }

  if (cargando) return <div className="page-content"><div className="loader-center"><div className="loader" /></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen financiero — Período {resumen?.periodoFiscal || new Date().getFullYear()}</p>
        </div>
        <div>
          <button 
            className="btn btn-primary" 
            onClick={handleSincronizar} 
            disabled={sincronizando} 
            id="btn-sincronizar-dashboard"
          >
            <RefreshCw size={18} className={sincronizando ? 'spin' : ''} />
            {sincronizando ? 'Leyendo Correos...' : 'Leer Correos'}
          </button>
        </div>
      </div>

      <ResumenCards resumen={resumen?.resumen} />
      
      <TendenciaChart tendencia={tendencia} />

      <div className="dashboard-bottom-row">
        <GastosCategoriaList categorias={categorias} />
        <ProyeccionFiscal resumen={resumen} />
      </div>
    </div>
  );
}
