import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Receipt, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { resumenDashboardAPI, tendenciaMensualAPI, gastosPorCategoriaAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './DashboardPage.css';

const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

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

  const r = resumen?.resumen || {};

  if (cargando) return <div className="page-content"><div className="loader-center"><div className="loader" /></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen financiero — Período {resumen?.periodoFiscal || new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="dashboard-cards">
        <div className="dash-card glass-card animate-slide-up" style={{ '--delay': '0s' }}>
          <div className="dash-card-icon dash-card-icon--green"><TrendingUp size={22} /></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Ingresos</span>
            <span className="dash-card-value text-mono">{formatCRC(r.totalIngresos)}</span>
          </div>
        </div>
        <div className="dash-card glass-card animate-slide-up" style={{ '--delay': '0.1s' }}>
          <div className="dash-card-icon dash-card-icon--red"><TrendingDown size={22} /></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Gastos</span>
            <span className="dash-card-value text-mono">{formatCRC(r.totalGastos)}</span>
          </div>
        </div>
        <div className="dash-card glass-card animate-slide-up" style={{ '--delay': '0.2s' }}>
          <div className="dash-card-icon dash-card-icon--amber"><Receipt size={22} /></div>
          <div className="dash-card-info">
            <span className="dash-card-label">IVA Cuatrimestre</span>
            <span className="dash-card-value text-mono">
              {(r.ivaAPagar || 0) > 0 ? formatCRC(r.ivaAPagar) : (r.ivaCredito || 0) > 0 ? `Crédito ${formatCRC(r.ivaCredito)}` : formatCRC(0)}
            </span>
          </div>
        </div>
        <div className="dash-card glass-card animate-slide-up" style={{ '--delay': '0.3s' }}>
          <div className="dash-card-icon dash-card-icon--blue"><DollarSign size={22} /></div>
          <div className="dash-card-info">
            <span className="dash-card-label">Utilidad Neta</span>
            <span className="dash-card-value text-mono">{formatCRC(r.utilidadNeta)}</span>
          </div>
        </div>
      </div>

      {/* Gráfico de tendencia mensual */}
      <div className="glass-card dashboard-chart animate-slide-up" style={{ '--delay': '0.4s' }}>
        <h3 className="chart-title">Ingresos vs Gastos Mensuales</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={tendencia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="mes" stroke="var(--color-texto-sec)" fontSize={12} />
            <YAxis stroke="var(--color-texto-sec)" fontSize={12} tickFormatter={v => `₡${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'var(--color-superficie)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-texto)' }}
              formatter={(v) => [`₡${v.toLocaleString('es-CR')}`, '']}
            />
            <Legend />
            <Bar dataKey="ingresos" name="Ingresos" fill="var(--color-primario-claro)" radius={[4,4,0,0]} />
            <Bar dataKey="gastos" name="Gastos" fill="var(--color-error)" radius={[4,4,0,0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gastos por categoría y proyección de impuestos */}
      <div className="dashboard-bottom-row">
        <div className="glass-card animate-slide-up" style={{ '--delay': '0.5s' }}>
          <h3 className="chart-title">Gastos por Categoría (IA)</h3>
          {categorias.length === 0 ? (
            <p style={{ color: 'var(--color-texto-sec)', padding: '2rem 0', textAlign: 'center' }}>
              Sin datos aún. Las facturas serán categorizadas automáticamente.
            </p>
          ) : (
            <div className="categoria-list">
              {categorias.map((cat) => (
                <div key={cat.categoria} className="categoria-item">
                  <div className="categoria-info">
                    <span className="categoria-nombre">{cat.categoria.replace(/_/g, ' ')}</span>
                    <span className="categoria-count">{cat.cantidad} factura(s)</span>
                  </div>
                  <span className="categoria-monto text-mono">{formatCRC(cat.totalGasto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card animate-slide-up" style={{ '--delay': '0.6s' }}>
          <h3 className="chart-title">Proyección Fiscal</h3>
          <div className="proyeccion-items">
            <div className="proyeccion-item">
              <div className="proyeccion-label">
                <AlertTriangle size={16} className="proyeccion-icon" />
                <span>Renta Anual Estimada</span>
              </div>
              <span className="proyeccion-valor text-mono">
                {formatCRC(resumen?.rentaProyectada?.impuestoFinal || 0)}
              </span>
              {(resumen?.rentaProyectada?.impuestoFinal || 0) === 0 && (
                <span className="badge badge-exito">Exento</span>
              )}
            </div>
            <div className="proyeccion-item">
              <div className="proyeccion-label">
                <ArrowUpRight size={16} className="proyeccion-icon" />
                <span>IVA Cuatrimestre Actual</span>
              </div>
              <span className="proyeccion-valor text-mono">
                {(r.ivaAPagar || 0) > 0 ? formatCRC(r.ivaAPagar) : `Crédito ${formatCRC(r.ivaCredito || 0)}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
