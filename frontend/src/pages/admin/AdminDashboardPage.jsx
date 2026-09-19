import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { obtenerResumenAdminAPI } from '../../services/adminApi';
import './admin.css';

const COLORES_PLAN = { pro: '#f59e0b', free: '#64748b' };
const NOMBRES_PLAN = { free: 'Gratis', pro: 'Pro' };
const NOMBRES_ESTADO = {
  activo: 'Activo',
  suspendido: 'Suspendido',
  periodo_gracia: 'Período de gracia',
  cancelado: 'Cancelado',
};

export default function AdminDashboardPage() {
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerResumenAdminAPI()
      .then((res) => setResumen(res.data))
      .catch((err) => setError(err.response?.data?.error || err.message || 'Error al cargar métricas'));
  }, []);

  if (error) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Panel de Administración</h1>
        </div>
        <p className="admin-error-text">No se pudieron cargar las métricas: {error}</p>
      </div>
    );
  }

  if (!resumen) {
    return <div className="loader-center"><div className="loader" /></div>;
  }

  const datosPlan = Object.entries(resumen.tenants.porPlan || {}).map(([plan, total]) => ({
    name: NOMBRES_PLAN[plan] || plan,
    value: total,
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Panel de Administración</h1>
          <p className="page-subtitle">Visión global de la plataforma ContadorGanadero.</p>
        </div>
      </div>

      {/* Tarjetas principales */}
      <div className="admin-grid-cards">
        <div className="admin-stat-card">
          <div className="stat-label">Usuarios totales</div>
          <div className="stat-value">{resumen.usuarios.total}</div>
          <div className="stat-sub">{resumen.usuarios.suspendidos} suspendidos</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Nuevos (30 días)</div>
          <div className="stat-value">{resumen.usuarios.nuevos30d}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Tenants / Fincas</div>
          <div className="stat-value">{resumen.tenants.total}</div>
          <div className="stat-sub">
            {(Object.entries(resumen.tenants.porEstado || {}))
              .map(([e, t]) => `${NOMBRES_ESTADO[e] || e}: ${t}`).join(' · ')}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">MRR estimado</div>
          <div className="stat-value">${resumen.suscripciones.mrrEstimadoUSD}</div>
          <div className="stat-sub">{resumen.suscripciones.proActivos} tenant(s) Pro activos</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Facturas procesadas</div>
          <div className="stat-value">{resumen.actividad.facturasTotal}</div>
          <div className="stat-sub">{resumen.actividad.facturas30d} en los últimos 30 días</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Ingresos registrados</div>
          <div className="stat-value">{resumen.actividad.ingresosRegistrados}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Feedback del chat</div>
          <div className="stat-value">
            {resumen.chatFeedback.positivo || 0} / {resumen.chatFeedback.negativo || 0}
          </div>
          <div className="stat-sub">positivos / negativos</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Eventos ONVO (24h)</div>
          <div className="stat-value">{resumen.suscripciones.eventosOnvo24h}</div>
          <div className={`stat-sub ${resumen.suscripciones.eventosOnvoConError > 0 ? 'admin-error-text' : ''}`}>
            {resumen.suscripciones.eventosOnvoConError} eventos con error acumulados
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="admin-chart-grid">
        <div className="admin-panel">
          <h2>Registros de usuarios (últimos 30 días)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={resumen.usuarios.registrosPorDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="fecha" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Area type="monotone" dataKey="total" name="Registros" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-panel">
          <h2>Tenants por plan</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={datosPlan} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {datosPlan.map((entry) => (
                  <Cell key={entry.name} fill={COLORES_PLAN[entry.name === 'Pro' ? 'pro' : 'free'] || '#38bdf8'} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
