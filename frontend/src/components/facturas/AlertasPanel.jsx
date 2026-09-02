import { AlertTriangle, XCircle, DollarSign } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

export default function AlertasPanel({ alertasTarifa }) {
  if (!alertasTarifa || alertasTarifa.totalAlertas === 0) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-950/20 backdrop-blur-md mb-6 shadow-xl overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold font-heading text-base text-amber-200">Alertas de Tarifa Agropecuaria (REA)</h3>
                <Badge variant="amber" className="text-[10px]">
                  {alertasTarifa.totalAlertas} producto(s)
                </Badge>
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Se detectaron compras de insumos agropecuarios facturadas al 13% en lugar del 1% reducido.
              </p>
            </div>
          </div>

          <div className="sm:text-right bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 self-start sm:self-auto">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Ahorro potencial</span>
            <span className="text-lg font-bold font-mono text-white flex items-center gap-1 sm:justify-end">
              <DollarSign size={15} className="text-amber-400 -mr-1" />
              {formatCRC(alertasTarifa.totalAhorrosPerdidos)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {alertasTarifa.alertas.slice(0, 4).map((a, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                {a.severidad === 'error' ? (
                  <XCircle size={15} className="text-red-400 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                )}
                <div className="truncate">
                  <strong className="text-white">{a.emisor}</strong>
                  <span className="text-slate-400 mx-1.5">•</span>
                  <span className="text-slate-300">{a.descripcion}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700 bg-slate-800/40">
                  {a.tarifaActual}% → {a.tarifaEsperada}%
                </Badge>
                {a.diferenciaIVA > 0 && (
                  <span className="font-mono font-semibold text-amber-400 text-xs">
                    +{formatCRC(a.diferenciaIVA)}
                  </span>
                )}
              </div>
            </div>
          ))}

          {alertasTarifa.totalAlertas > 4 && (
            <p className="text-xs text-amber-400/80 text-center pt-1">
              ... y {alertasTarifa.totalAlertas - 4} alerta(s) adicionales en tus comprobantes
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
