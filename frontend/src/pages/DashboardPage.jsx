import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { resumenDashboardAPI, tendenciaMensualAPI, gastosPorCategoriaAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import ResumenCards from '../components/dashboard/ResumenCards';
import TendenciaChart from '../components/dashboard/TendenciaChart';
import GastosCategoriaList from '../components/dashboard/GastosCategoriaList';
import ProyeccionFiscal from '../components/dashboard/ProyeccionFiscal';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    let activo = true;
    const anio = new Date().getFullYear();
    Promise.all([
      resumenDashboardAPI(),
      tendenciaMensualAPI(anio),
      gastosPorCategoriaAPI(anio)
    ])
      .then(([res, tend, cat]) => {
        if (activo) {
          setResumen(res.data);
          setTendencia(tend.data);
          setCategorias(cat.data);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (activo) {
          setCargando(false);
        }
      });
    return () => { activo = false; };
  }, []);

  async function handleRefrescar() {
    setRefrescando(true);
    try {
      const data = await cargarData();
      setResumen(data.resumen);
      setTendencia(data.tendencia);
      setCategorias(data.categorias);
      toast.success('Métricas actualizadas');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar métricas');
    } finally {
      setRefrescando(false);
    }
  }

  if (cargando) {
    return (
      <div className="page-content">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400 font-medium">Cargando métricas de la finca...</p>
          </div>
        </div>
      </div>
    );
  }

  const hayIngresos = tendencia.some(t => t.ingresos > 0);
  const alertaIngresos = !hayIngresos && resumen?.resumen?.totalGastos > 0;

  return (
    <div className="page-content">
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title text-2xl md:text-3xl font-bold font-heading text-white">Dashboard</h1>
            <Badge variant="default" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Período {resumen?.periodoFiscal || new Date().getFullYear()}
            </Badge>
          </div>
          <p className="page-subtitle text-slate-400 text-sm mt-1">Resumen financiero y estado tributario del Régimen REA</p>
        </div>
        <div className="dashboard-actions w-full md:w-auto">
          <Button
            id="btn-refrescar-dashboard"
            variant="outline"
            size="sm"
            className="h-9 px-4 gap-2 text-slate-300 hover:text-white border-slate-800 bg-slate-900/60 font-medium shadow-sm w-full sm:w-auto justify-center"
            onClick={handleRefrescar}
            disabled={refrescando}
          >
            <RefreshCw size={15} className={refrescando ? 'animate-spin text-emerald-400' : ''} />
            {refrescando ? 'Actualizando...' : 'Refrescar'}
          </Button>
        </div>
      </div>

      {alertaIngresos && (
        <div className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3 shadow-md backdrop-blur-sm">
          <AlertCircle size={20} className="shrink-0 text-amber-400" />
          <span>No hay ingresos registrados en el período. Dirígete a <strong>Ingresos</strong> para registrar ventas de ganado, leche u otros productos.</span>
        </div>
      )}

      <ResumenCards resumen={resumen?.resumen} />
      
      <TendenciaChart tendencia={tendencia} />

      <div className="dashboard-bottom-row mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GastosCategoriaList categorias={categorias} />
        <ProyeccionFiscal resumen={resumen} />
      </div>
    </div>
  );
}
