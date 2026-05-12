import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function DistribucionGastos({ cargando, datosGrafico, COLORES }) {
  return (
    <div className="card grafico-card">
      <div className="card-header">
        <h2 className="card-title">Distribución de Gastos</h2>
      </div>
      <div className="grafico-container">
        {cargando ? (
          <p>Cargando datos...</p>
        ) : datosGrafico.length === 0 ? (
          <p className="text-muted">No hay facturas procesadas aún.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={datosGrafico}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {datosGrafico.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `₡${value.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
