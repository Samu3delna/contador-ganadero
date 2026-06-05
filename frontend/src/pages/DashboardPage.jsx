import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { resumenDashboardAPI, tendenciaMensualAPI, gastosPorCategoriaAPI, sincronizarEmailAPI } from '../services/api';
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
    return () => {
      activo = false;
    };
  }, []);

  async function handleSincronizar() {
    setSincronizando(true);
    try {
      await sincronizarEmailAPI();
      const data = await cargarData();
      setResumen(data.resumen);
      setTendencia(data.tendencia);
      setCategorias(data.categorias);
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
