import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function TendenciaChart({ tendencia }) {
  return (
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
  );
}
