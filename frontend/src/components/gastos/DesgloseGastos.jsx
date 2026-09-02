import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Layers } from 'lucide-react';

export default function DesgloseGastos({ datosGrafico, COLORES, categoriaSeleccionada, setCategoriaSeleccionada, setFacturaSeleccionada }) {
  const total = datosGrafico.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-amber-400" />
            <CardTitle className="text-lg font-bold font-heading text-white">Desglose por Categoría</CardTitle>
          </div>
          <span className="text-xs text-slate-400">Clic para filtrar</span>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {datosGrafico.map((item, index) => {
            const porcentaje = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            const seleccionado = categoriaSeleccionada === item.id;

            return (
              <div 
                key={index} 
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  seleccionado 
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30' 
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
                onClick={() => {
                  setCategoriaSeleccionada(item.id === categoriaSeleccionada ? null : item.id);
                  setFacturaSeleccionada(null);
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-3.5 w-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: COLORES[index % COLORES.length] }} />
                  <span className="text-sm font-medium text-slate-200 truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] bg-slate-800/80 border-slate-700 font-mono text-slate-400">
                    {porcentaje}%
                  </Badge>
                  <span className="text-sm font-mono font-semibold text-white">₡{item.value.toLocaleString('es-CR')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
