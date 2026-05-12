import { useState, useEffect } from 'react';
import { resumenDashboardAPI, tendenciaMensualAPI, gastosPorCategoriaAPI } from '../services/api';
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

  useEffect(() => {
    async function cargar() {
      try {
        const [res, tend, cat] = await Promise.all([
          resumenDashboardAPI(), tendenciaMensualAPI(), gastosPorCategoriaAPI()
        ]);
        setResumen(res.data);
        setTendencia(tend.data);
        setCategorias(cat.data);
      } catch (err) { console.error(err); }
      finally { setCargando(false); }
    }
    cargar();
  }, []);

  if (cargando) return <div className="page-content"><div className="loader-center"><div className="loader" /></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen financiero — Período {resumen?.periodoFiscal || new Date().getFullYear()}</p>
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
