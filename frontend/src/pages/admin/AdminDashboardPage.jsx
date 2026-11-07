import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Tractor, Wallet, FileText, RefreshCw, Activity, LifeBuoy, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { obtenerResumenAdminAPI } from '../../services/adminApi';
import { DashboardHeaderSkeleton, MetricCardSkeleton, ChartSkeleton, ListSkeleton } from '../../components/dashboard/DashboardSkeletons';
import './admin.css';

const NOMBRES_ESTADO = { activo: 'Activas', suspendido: 'Suspendidas', periodo_gracia: 'En período de gracia', cancelado: 'Canceladas' };
const number = new Intl.NumberFormat('es-CR');
const usd = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' });
const tooltipStyle = { background: 'var(--color-superficie)', color: 'var(--color-texto)', border: '1px solid var(--color-borde)', borderRadius: 12 };
const actions = [
  { to: '/admin/usuarios', label: 'Gestionar usuarios', Icon: Users },
  { to: '/admin/tenants', label: 'Gestionar fincas', Icon: Tractor },
  { to: '/admin/monitoreo', label: 'Revisar monitoreo', Icon: Activity },
  { to: '/admin/soporte', label: 'Abrir soporte', Icon: LifeBuoy },
];

function AdminDashboardSkeleton() {
  return <div className="page-content admin-overview" aria-busy="true" aria-label="Cargando panel de administración">
    <span className="sr-only" role="status">Cargando métricas de la plataforma…</span>
    <div aria-hidden="true"><DashboardHeaderSkeleton /><div className="admin-overview-kpis">{[0,1,2,3].map(i => <MetricCardSkeleton key={i} />)}</div><ListSkeleton /><div className="admin-chart-grid"><ChartSkeleton /><ChartSkeleton /></div></div>
  </div>;
}

function Metric({ Icon, title, value, detail }) {
  return <article className="admin-stat-card"><div className="admin-metric-heading"><span>{title}</span><Icon size={20} aria-hidden="true" /></div><p className="stat-value">{value}</p><p className="stat-sub">{detail}</p></article>;
}

export default function AdminDashboardPage() {
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const requestId = useRef(0);

  async function fetchResumen(id) {
    try {
      const { data } = await obtenerResumenAdminAPI();
      if (!data?.usuarios || !data?.tenants || !data?.suscripciones || !data?.actividad || !data?.chatFeedback || !data.tenants.porEstado || !data.tenants.porPlan || !Array.isArray(data.usuarios.registrosPorDia) || [data.usuarios.total, data.usuarios.nuevos30d, data.usuarios.suspendidos, data.tenants.total, data.suscripciones.mrrEstimadoUSD, data.suscripciones.proActivos, data.suscripciones.eventosOnvo24h, data.suscripciones.eventosOnvoConError, data.actividad.facturasTotal, data.actividad.facturas30d, data.actividad.ingresosRegistrados].some(value => !Number.isFinite(value))) throw new Error('La respuesta de métricas está incompleta.');
      if (id === requestId.current) { setResumen(data); setUpdatedAt(new Date()); }
    } catch (err) {
      if (id === requestId.current) setError(err.response?.data?.error || err.message || 'No se pudieron consultar las métricas.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  function load() {
    setLoading(true);
    setError('');
    fetchResumen(++requestId.current);
  }
  useEffect(() => {
    const id = ++requestId.current;
    fetchResumen(id);
    return () => { requestId.current = id + 1; };
  }, []);

  if (loading && !resumen) return <AdminDashboardSkeleton />;
  const plans = Object.entries(resumen?.tenants.porPlan || {}).map(([key, value]) => ({ key, name: key === 'pro' ? 'Pro' : key === 'free' ? 'Gratis' : key, value }));
  const registrations = resumen?.usuarios.registrosPorDia || [];

  return <div className="page-content admin-overview" aria-busy={loading}>
    <header className="admin-overview-header">
      <div><h1 className="page-title">Panel de Administración</h1><p className="page-subtitle">Visión general de ContadorGanadero.</p></div>
      <div className="admin-refresh"><span role="status">{loading ? 'Actualizando métricas…' : updatedAt ? `Actualizado ${updatedAt.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span><button className="admin-btn" onClick={load} disabled={loading}><RefreshCw size={16} aria-hidden="true" />Actualizar</button></div>
    </header>
    {error && <div className="admin-dashboard-error" role="alert"><ShieldAlert size={20} aria-hidden="true" /><div><strong>{resumen ? 'No se pudo actualizar el panel.' : 'No se pudieron cargar las métricas.'}</strong><p>{error}</p>{resumen && <p>Se conservan los últimos datos cargados.</p>}<button className="admin-btn" onClick={load} disabled={loading}>Reintentar</button></div></div>}
    {resumen && <>
      <section className="admin-overview-kpis" aria-label="Indicadores principales">
        <Metric Icon={Users} title="Usuarios totales" value={number.format(resumen.usuarios.total)} detail={`${number.format(resumen.usuarios.nuevos30d)} nuevos en los últimos 30 días`} />
        <Metric Icon={Tractor} title="Fincas registradas" value={number.format(resumen.tenants.total)} detail="Todas las fincas de la plataforma" />
        <Metric Icon={Wallet} title="MRR estimado" value={usd.format(resumen.suscripciones.mrrEstimadoUSD)} detail={`${number.format(resumen.suscripciones.proActivos)} fincas Pro activas · No representa cobros recibidos`} />
        <Metric Icon={FileText} title="Facturas procesadas" value={number.format(resumen.actividad.facturasTotal)} detail={`${number.format(resumen.actividad.facturas30d)} en los últimos 30 días`} />
      </section>
      <section className="admin-panel admin-operations" aria-labelledby="operations-title"><div className="admin-section-heading"><h2 id="operations-title">Seguimiento operativo</h2><Link to="/admin/monitoreo">Ver monitoreo <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        <div className="admin-operation-grid"><div><span>Errores ONVO acumulados</span><strong className={resumen.suscripciones.eventosOnvoConError > 0 ? 'admin-error-text' : ''}>{number.format(resumen.suscripciones.eventosOnvoConError)}</strong></div><div><span>Usuarios suspendidos</span><strong>{number.format(resumen.usuarios.suspendidos)}</strong></div><div className="admin-farm-states"><span>Estado de las fincas</span><div>{Object.entries(resumen.tenants.porEstado).length ? Object.entries(resumen.tenants.porEstado).map(([state,total]) => <span className={`admin-badge admin-badge--${state}`} key={state}>{NOMBRES_ESTADO[state] || state}: {number.format(total)}</span>) : <span>Sin fincas registradas</span>}</div></div></div>
      </section>
      <div className="admin-chart-grid">
        <section className="admin-panel"><h2>Registros de usuarios</h2><p className="admin-chart-caption">Últimos 30 días · Registros por fecha reportada</p>{registrations.length ? <><div aria-label="Gráfico de registros diarios"><ResponsiveContainer width="100%" height={260}><AreaChart data={registrations} margin={{ left: -20, right: 12, top: 10 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-borde)" /><XAxis dataKey="fecha" tick={{ fill: 'var(--color-texto-sec)', fontSize: 11 }} tickFormatter={value => value.slice(5)} minTickGap={25} /><YAxis allowDecimals={false} tick={{ fill: 'var(--color-texto-sec)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--color-texto)' }} /><Area isAnimationActive={false} type="monotone" dataKey="total" name="Registros" stroke="var(--color-primario-claro)" fill="var(--color-primario-claro)" fillOpacity={0.13} strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div><details className="admin-chart-data"><summary>Consultar datos del gráfico</summary><table><thead><tr><th>Fecha</th><th>Registros</th></tr></thead><tbody>{registrations.map(row => <tr key={row.fecha}><td>{row.fecha}</td><td>{number.format(row.total)}</td></tr>)}</tbody></table></details></> : <p className="admin-chart-empty">No hay registros de usuarios en los últimos 30 días.</p>}</section>
        <section className="admin-panel"><h2>Distribución de planes</h2><p className="admin-chart-caption">Fincas por plan contratado</p>{plans.some(p => p.value > 0) ? <><div aria-hidden="true"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={plans} dataKey="value" nameKey="name" innerRadius={65} outerRadius={90} paddingAngle={3} isAnimationActive={false}>{plans.map(p => <Cell key={p.key} fill={p.key === 'pro' ? 'var(--color-primario-claro)' : 'var(--color-texto-sec)'} stroke="var(--color-superficie)" />)}</Pie><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--color-texto)' }} /></PieChart></ResponsiveContainer></div><ul className="admin-plan-legend">{plans.map(p => <li key={p.key}><span>{p.name}</span><strong>{number.format(p.value)}</strong></li>)}</ul></> : <p className="admin-chart-empty">La distribución aparecerá cuando se registren fincas.</p>}</section>
      </div>
      <section className="admin-quick-actions" aria-label="Acciones de administración">{actions.map(({ to, label, Icon }) => <Link to={to} key={to}><Icon size={20} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</section>
      <details className="admin-panel admin-advanced"><summary>Métricas avanzadas <span>Actividad, suscripciones y asistente</span></summary><dl className="admin-advanced-grid">{[
        ['Nuevos usuarios (30 días)', resumen.usuarios.nuevos30d], ['Usuarios suspendidos', resumen.usuarios.suspendidos], ['Facturas (30 días)', resumen.actividad.facturas30d], ['Ingresos registrados (cantidad)', resumen.actividad.ingresosRegistrados], ['Feedback positivo del asistente', resumen.chatFeedback.positivo || 0], ['Feedback negativo del asistente', resumen.chatFeedback.negativo || 0], ['Eventos ONVO (24 horas)', resumen.suscripciones.eventosOnvo24h], ['Errores ONVO acumulados', resumen.suscripciones.eventosOnvoConError], ['Fincas Pro activas', resumen.suscripciones.proActivos],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number.format(value)}</dd></div>)}</dl></details>
    </>}
  </div>;
}
