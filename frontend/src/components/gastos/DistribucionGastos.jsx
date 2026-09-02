import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { PieChart as PieChartIcon } from 'lucide-react';

export default function DistribucionGastos({ cargando, datosGrafico, COLORES }) {
  return (
    <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md">
      <CardHeader className="p-5 pb-2">
        <div className="flex items-center gap-2">
          <PieChartIcon size={18} className="text-emerald-400" />
          <CardTitle className="text-lg font-bold font-heading text-white">Distribución de Gastos</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-2">
        {cargando ? (
          <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mr-2" />
            Cargando gráfico...
          </div>
        ) : datosGrafico.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
            No hay facturas procesadas aún.
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosGrafico}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {datosGrafico.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} stroke="rgba(15,23,42,0.8)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `₡${value.toLocaleString('es-CR')}`} 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#f8fafc' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
