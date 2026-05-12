import { AlertTriangle, XCircle } from 'lucide-react';

const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

export default function AlertasPanel({ alertasTarifa }) {
  if (!alertasTarifa || alertasTarifa.totalAlertas === 0) return null;

  return (
    <div className="glass-card alertas-panel animate-slide-up">
      <div className="alertas-header">
        <div className="alertas-icon">
          <AlertTriangle size={24} />
        </div>
        <div className="alertas-info">
          <h3>⚠️ Alertas de Tarifa Agropecuaria</h3>
          <p>
            Se encontraron <strong>{alertasTarifa.totalAlertas}</strong> producto(s) que podrían estar
            cobrando IVA al 13% cuando deberían pagar solo el 1%.
          </p>
        </div>
        <div className="alertas-monto">
          <span className="alertas-label">Ahorros perdidos</span>
          <span className="alertas-valor">{formatCRC(alertasTarifa.totalAhorrosPerdidos)}</span>
        </div>
      </div>
      <div className="alertas-detalle">
        {alertasTarifa.alertas.slice(0, 5).map((a, i) => (
          <div key={i} className={`alerta-item alerta-${a.severidad}`}>
            {a.severidad === 'error' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
            <div className="alerta-texto">
              <strong>{a.emisor}</strong> — {a.descripcion}
              <span className="alerta-tarifa">
                Código {a.codigoTarifaActual} ({a.tarifaActual}%) →
                Debería ser {a.codigoTarifaEsperado} ({a.tarifaEsperada}%)
              </span>
            </div>
            {a.diferenciaIVA > 0 && (
              <span className="alerta-diff">+{formatCRC(a.diferenciaIVA)}</span>
            )}
          </div>
        ))}
        {alertasTarifa.totalAlertas > 5 && (
          <p className="alertas-mas">
            ... y {alertasTarifa.totalAlertas - 5} alerta(s) más
          </p>
        )}
      </div>
    </div>
  );
}
