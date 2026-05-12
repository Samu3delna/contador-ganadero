import { Wifi, WifiOff } from 'lucide-react';

export default function EmailStatus({ estadoEmail }) {
  return (
    <div className="glass-card email-status animate-slide-up">
      <div className="email-status-indicator">
        {estadoEmail?.conectado ? <Wifi size={18} className="status-green" /> : <WifiOff size={18} className="status-red" />}
        <span>{estadoEmail?.conectado ? 'Email conectado' : 'Email desconectado'}</span>
      </div>
      <span className="email-status-detail">
        {estadoEmail?.usuario || 'No configurado'} • Última sync: {estadoEmail?.ultimaSincronizacion ? new Date(estadoEmail.ultimaSincronizacion).toLocaleString('es-CR') : 'Nunca'}
        {estadoEmail?.estadisticas && ` • XMLs: ${estadoEmail.estadisticas.xmlsDescargados} • Alertas: ${estadoEmail.estadisticas.alertasTarifa}`}
      </span>
    </div>
  );
}
