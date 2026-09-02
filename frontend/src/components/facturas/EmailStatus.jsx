import { Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

export default function EmailStatus({ estadoEmail }) {
  const conectado = !!estadoEmail?.conectado;

  return (
    <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-md mb-6">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${conectado ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {conectado ? <Wifi size={18} /> : <WifiOff size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">{conectado ? 'Servidor IMAP Conectado' : 'Email Desconectado'}</span>
              <Badge variant={conectado ? 'default' : 'destructive'} className="text-[10px] px-2 py-0 h-4">
                {conectado ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <span className="text-xs text-slate-400">
              {estadoEmail?.usuario || 'No configurado'}
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 sm:text-right">
          <span>Última sync: <strong className="text-slate-200">{estadoEmail?.ultimaSincronizacion ? new Date(estadoEmail.ultimaSincronizacion).toLocaleString('es-CR') : 'Nunca'}</strong></span>
          {estadoEmail?.estadisticas && (
            <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
              <Badge variant="outline" className="text-[10px] bg-slate-800/60 border-slate-700">
                {estadoEmail.estadisticas.xmlsDescargados} XMLs
              </Badge>
              {estadoEmail.estadisticas.alertasTarifa > 0 && (
                <Badge variant="amber" className="text-[10px]">
                  {estadoEmail.estadisticas.alertasTarifa} Alertas
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
