import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react';
import { resumenDashboardAPI, tendenciaMensualAPI, gastosPorCategoriaAPI, sincronizarEmailAPI, sincronizarEmailCompletoAPI } from '../services/api';
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
  const [sincronizando, setSincronizando] = useState(false);
  const [modoSync, setModoSync] = useState('rapido');
  const [ultimoResultado, setUltimoResultado] = useState(null);

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

  async function handleSincronizar() {
    setSincronizando(true);
    try {
      let resultado;
      if (modoSync === 'rapido') {
        resultado = await sincronizarEmailAPI(true);
      } else {
        resultado = await sincronizarEmailCompletoAPI();
      }
      setUltimoResultado(resultado.data);
      const data = await cargarData();
      setResumen(data.resumen);
      setTendencia(data.tendencia);
      setCategorias(data.categorias);
      toast.success('Correos sincronizados correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al sincronizar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSincronizando(false);
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="inline-flex rounded-lg bg-slate-900/80 p-1 border border-slate-800 justify-center">
              <Button
                variant={modoSync === 'rapido' ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-xs h-8 px-3 flex-1 sm:flex-none ${modoSync === 'rapido' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
                onClick={() => setModoSync('rapido')}
                disabled={sincronizando}
                title="Solo emails no leídos (~10-15s)"
              >
                Rápido
              </Button>
              <Button
                variant={modoSync === 'completo' ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-xs h-8 px-3 flex-1 sm:flex-none ${modoSync === 'completo' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
                onClick={() => setModoSync('completo')}
                disabled={sincronizando}
                title="Todos los emails últimos 60 días (~2-3 min)"
              >
                Completo
              </Button>
            </div>

            <Button
              id="btn-sincronizar-dashboard"
              variant="gradient"
              size="sm"
              className="h-9 px-4 gap-2 font-semibold shadow-md shadow-emerald-950/40 w-full sm:w-auto justify-center"
              onClick={handleSincronizar}
              disabled={sincronizando}
            >
              {sincronizando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {modoSync === 'rapido' ? 'Leyendo correos...' : 'Sincronizando todo...'}
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Sincronizar Facturas
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {alertaIngresos && (
        <div className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3 shadow-md backdrop-blur-sm">
          <AlertCircle size={20} className="shrink-0 text-amber-400" />
          <span>No hay ingresos registrados en el período. Dirígete a <strong>Ingresos</strong> para registrar ventas de ganado, leche u otros productos.</span>
        </div>
      )}

      {ultimoResultado && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 shadow-md backdrop-blur-sm">
          <CheckCircle size={20} className="shrink-0 text-emerald-400" />
          <span>
            Sincronización completada: {ultimoResultado.estadisticas?.emailsProcesados || 0} correos revisados, {ultimoResultado.estadisticas?.facturasCreadas || 0} facturas procesadas y {ultimoResultado.estadisticas?.xmlsDescargados || 0} XMLs guardados.
          </span>
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
