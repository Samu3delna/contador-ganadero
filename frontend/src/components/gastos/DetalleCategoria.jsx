import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { FileText, Calendar } from 'lucide-react';

export default function DetalleCategoria({ categoriaSeleccionada, datosGrafico, facturasFiltradas, setFacturaSeleccionada }) {
  if (!categoriaSeleccionada) return null;

  const nombreCategoria = datosGrafico.find(d => d.id === categoriaSeleccionada)?.name || categoriaSeleccionada;

  return (
    <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md mt-6 animate-in fade-in zoom-in-95 duration-200">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-emerald-400" />
            <CardTitle className="text-lg font-bold font-heading text-white">
              Facturas en: <span className="text-emerald-400">{nombreCategoria}</span>
            </CardTitle>
          </div>
          <Badge variant="default" className="text-xs">
            {facturasFiltradas.length} comprobante(s)
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-5 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {facturasFiltradas.map(f => (
            <div 
              key={f._id} 
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-emerald-500/50 hover:bg-slate-800/80 cursor-pointer transition-all duration-200 space-y-2 group shadow-sm"
              onClick={() => setFacturaSeleccionada(f)}
            >
              <div className="flex items-start justify-between gap-2">
                <strong className="text-sm text-white font-medium truncate block group-hover:text-emerald-300 transition-colors">
                  {f.emisor?.nombre || 'Emisor desconocido'}
                </strong>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-slate-800 border-slate-700 text-slate-400 shrink-0 flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(f.fechaEmision).toLocaleDateString('es-CR')}
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span className="text-xs text-slate-400">Total comprobante:</span>
                <span className="font-mono font-semibold text-emerald-400 text-sm">
                  ₡{f.resumenFactura?.totalComprobante?.toLocaleString('es-CR') || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
