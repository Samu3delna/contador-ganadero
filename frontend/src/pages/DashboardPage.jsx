import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, Plus, FileText, Warehouse, X, CircleHelp } from 'lucide-react';
import { resumenDashboardAPI, tendenciaMensualAPI, gastosPorCategoriaAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ResumenCards from '../components/dashboard/ResumenCards';
import TendenciaChart from '../components/dashboard/TendenciaChart';
import GastosCategoriaList from '../components/dashboard/GastosCategoriaList';
import ProyeccionFiscal from '../components/dashboard/ProyeccionFiscal';
import { ProducerDashboardSkeleton } from '../components/dashboard/DashboardSkeletons';
import './DashboardPage.css';

async function cargarData() {
  const res = await resumenDashboardAPI();
  if (!res.data?.resumen || !res.data.periodoFiscal) throw new Error('Resumen no disponible');
  const [tend, cat] = await Promise.all([tendenciaMensualAPI(res.data.periodoFiscal), gastosPorCategoriaAPI(res.data.periodoFiscal)]);
  if (!Array.isArray(tend.data) || !Array.isArray(cat.data)) throw new Error('Datos no disponibles');
  return { resumen: res.data, tendencia: tend.data, categorias: cat.data };
}
const acciones = [{ to: '/ingresos', label: 'Registrar ingreso', Icon: Plus }, { to: '/facturas', label: 'Ver facturas', Icon: FileText }, { to: '/inventario', label: 'Consultar inventario', Icon: Warehouse }];
export default function DashboardPage() {
  const { usuario } = useAuth();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ayuda, setAyuda] = useState(() => { try { const saved = localStorage.getItem('cg-dashboard-help'); return saved === 'hidden' ? false : saved === 'visible' ? true : null; } catch { return null; } });
  const request = useRef(0);
  useEffect(() => {
    const tracker = request;
    const id = ++tracker.current;
    cargarData().then(value => { if (id === request.current) setData(value); }).catch(() => { if (id === request.current) setError('No pudimos cargar los datos de tu finca. Intenta nuevamente.'); }).finally(() => { if (id === request.current) setCargando(false); });
    return () => { tracker.current++; };
  }, []);
  async function actualizar() {
    const id = ++request.current;
    setCargando(true); setError('');
    try { const value = await cargarData(); if (id === request.current) setData(value); }
    catch { if (id === request.current) setError('No pudimos actualizar los datos. Puedes volver a intentarlo.'); }
    finally { if (id === request.current) setCargando(false); }
  }
  function cambiarAyuda(value) { setAyuda(value); try { localStorage.setItem('cg-dashboard-help', value ? 'visible' : 'hidden'); } catch { /* Preference is optional. */ } }
  if (!data && cargando) return <ProducerDashboardSkeleton />;
  const r = data?.resumen;
  const vacio = r && r.resumen.totalIngresos === 0 && r.resumen.totalGastos === 0;
  const mostrarAyuda = ayuda === true || (ayuda !== false && (vacio || r?.ivaProyectado?.totalFacturas < 3));
  return <div className="page-content producer-dashboard" aria-busy={cargando}>
    <header className="page-header producer-header"><div><p className="producer-finca">{usuario?.nombreFinca || usuario?.tenant?.nombreFinca || 'Mi finca'}</p><h1 className="page-title">Tu finca, en números</h1><p className="page-subtitle">Resumen financiero{r ? ` · Período fiscal ${r.periodoFiscal} · Cuatrimestre ${r.cuatrimestreActual}` : ''}</p></div><button className="producer-button" onClick={actualizar} disabled={cargando}><RefreshCw size={17} className={cargando ? 'producer-refresh' : ''} aria-hidden="true" />{cargando ? 'Actualizando…' : 'Actualizar'}</button></header>
    <span className="sr-only" role="status">{cargando ? 'Actualizando métricas' : data && !error ? 'Métricas cargadas' : ''}</span>
    {error && <div className="producer-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><p>{error}</p>{data && <small>Se conserva la última información cargada.</small>}</div><button className="producer-button" onClick={actualizar} disabled={cargando}>Reintentar</button></div>}
    {data && <>
      <ResumenCards resumen={r.resumen} />
      <section className="producer-quick" aria-label="Acciones rápidas">{acciones.map(({ to, label, Icon }) => <Link to={to} key={to} className="producer-action"><Icon size={18} aria-hidden="true" />{label}</Link>)}<button className="producer-help" onClick={() => cambiarAyuda(!mostrarAyuda)} aria-expanded={mostrarAyuda}><CircleHelp size={18} aria-hidden="true" />{mostrarAyuda ? 'Ocultar guía' : 'Primeros pasos'}</button></section>
      {mostrarAyuda && <section className="producer-onboarding"><div><h2>Comienza a organizar tu finca</h2><p>Registra tus ingresos, consulta las facturas recibidas y explora tu inventario. Este panel reúne tus resultados del período.</p><div className="producer-guide-links"><Link to="/ingresos">Registrar ingresos</Link><Link to="/facturas">Consultar facturas</Link><Link to="/inventario">Explorar inventario</Link><a href="#movimiento-finca">Conocer el panel</a></div></div><button className="producer-help" onClick={() => cambiarAyuda(false)} aria-label="Cerrar guía"><X size={20} /></button></section>}
      {!vacio && r.resumen.totalIngresos === 0 && <div className="alerta-ingresos"><AlertCircle size={20} aria-hidden="true" /><p>Hay gastos y todavía no hay ingresos registrados en este período. <Link to="/ingresos">Registrar una venta</Link>.</p></div>}
      <TendenciaChart tendencia={data.tendencia} />
      <div className="producer-bottom"><GastosCategoriaList categorias={data.categorias} /><ProyeccionFiscal resumen={r} /></div>
    </>}
  </div>;
}
