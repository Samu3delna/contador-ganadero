import { TrendingUp, TrendingDown, DollarSign, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

export default function ResumenCards({ resumen }) {
  const r = resumen || {};

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Ingresos */}
      <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md hover:border-emerald-500/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110 pointer-events-none" />
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <TrendingUp size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ingresos</span>
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                <ArrowUpRight size={10} className="mr-0.5 inline" /> Total
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-white tracking-tight truncate">
              {formatCRC(r.totalIngresos)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gastos */}
      <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md hover:border-red-500/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110 pointer-events-none" />
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
            <TrendingDown size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gastos</span>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                <ArrowDownRight size={10} className="mr-0.5 inline" /> Egresos
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-white tracking-tight truncate">
              {formatCRC(r.totalGastos)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IVA Cuatrimestre */}
      <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md hover:border-amber-500/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110 pointer-events-none" />
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Receipt size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">IVA Cuatrimestre</span>
              <Badge variant="amber" className="text-[10px] px-1.5 py-0 h-4">
                D-135-1
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-white tracking-tight truncate">
              {(r.ivaAPagar || 0) > 0 ? formatCRC(r.ivaAPagar) : (r.ivaCredito || 0) > 0 ? `Crédito ${formatCRC(r.ivaCredito)}` : formatCRC(0)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Utilidad Neta */}
      <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md hover:border-sky-500/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110 pointer-events-none" />
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 shadow-inner">
            <DollarSign size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utilidad Neta</span>
              <Badge variant="blue" className="text-[10px] px-1.5 py-0 h-4">
                Margen
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-white tracking-tight truncate">
              {formatCRC(r.utilidadNeta)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
