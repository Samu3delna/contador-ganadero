import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  monitoreoEventosOnvoAPI, monitoreoChatFeedbackAPI, monitoreoEmailAPI, monitoreoSaludAPI,
} from '../../services/adminApi';
import './admin.css';

const formatearFecha = (f) => (f ? new Date(f).toLocaleString('es-CR') : '—');

const formatearUptime = (segundos) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

export default function AdminMonitoreoPage() {
  const [onvo, setOnvo] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [email, setEmail] = useState(null);
  const [salud, setSalud] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarTodo = async () => {
    setCargando(true);
    setError(null);
    try {
      const [rOnvo, rFeedback, rEmail, rSalud] = await Promise.all([
        monitoreoEventosOnvoAPI(30),
        monitoreoChatFeedbackAPI(30),
        monitoreoEmailAPI(),
        monitoreoSaludAPI(),
      ]);
      setOnvo(rOnvo.data);
      setFeedback(rFeedback.data);
      setEmail(rEmail.data);
      setSalud(rSalud.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar el monitoreo');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarTodo(); }, []);

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Monitoreo Operativo</h1>
          <p className="page-subtitle">Estado de webhooks, ingesta de correos, chat IA y salud del servidor.</p>
        </div>
        <button className="admin-btn" onClick={cargarTodo} disabled={cargando}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {error && <p className="admin-error-text">{error}</p>}

      {cargando && !salud ? (
        <div className="loader-center"><div className="loader" /></div>
      ) : (
        <>
          {/* Salud del sistema */}
          <div className="admin-grid-cards">
            <div className="admin-stat-card">
              <div className="stat-label">MongoDB</div>
              <div className={`stat-value ${salud?.mongo?.conectado ? 'admin-ok-text' : 'admin-error-text'}`}>
                {salud?.mongo?.conectado ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="stat-label">Uptime del servidor</div>
              <div className="stat-value">{formatearUptime(salud?.servidor?.uptimeSegundos || 0)}</div>
              <div className="stat-sub">Node {salud?.servidor?.node} · {salud?.servidor?.entorno}</div>
            </div>
            <div className="admin-stat-card">
              <div className="stat-label">Memoria (RSS / Heap)</div>
              <div className="stat-value">
                {salud?.servidor?.memoriaMB?.rss} MB / {salud?.servidor?.memoriaMB?.heapUsado} MB
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="stat-label">Eventos ONVO con error</div>
              <div className={`stat-value ${onvo?.conError > 0 ? 'admin-error-text' : 'admin-ok-text'}`}>
                {onvo?.conError ?? 0}
              </div>
            </div>
          </div>

          <div className="admin-dos-columnas">
            {/* Eventos ONVO */}
            <div className="admin-panel">
              <h2>Últimos eventos de suscripción (ONVO)</h2>
              <div className="admin-lista-seguimiento">
                {(onvo?.eventos || []).map((e) => (
                  <div key={e._id} className="admin-item-seguimiento">
                    <div className="item-principal">
                      {e.type}
                      <div className="item-meta">
                        {formatearFecha(e.createdAt)} · {e.tenantId?.nombreFinca || e.customerId || 'sin tenant'}
                        {e.error && <span className="admin-error-text"> · {e.error}</span>}
                      </div>
                    </div>
                    <span className={`admin-badge ${e.error ? 'admin-badge--negativo' : 'admin-badge--activo'}`}>
                      {e.error ? 'Error' : e.procesado ? 'Procesado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
                {(onvo?.eventos || []).length === 0 && (
                  <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Aún no hay eventos de ONVO registrados.</p>
                )}
              </div>
            </div>

            {/* Ingesta de correos */}
            <div className="admin-panel">
              <h2>Ingesta de facturas por correo</h2>
              <div className="admin-lista-seguimiento">
                <div className="admin-item-seguimiento">
                  <span className="item-principal">IMAP global (servidor)</span>
                  <span className={`admin-badge ${email?.canales?.imapGlobal?.configurado ? 'admin-badge--activo' : 'admin-badge--cancelado'}`}>
                    {email?.canales?.imapGlobal?.configurado ? 'Activo' : 'No config.'}
                  </span>
                </div>
                <div className="admin-item-seguimiento">
                  <span className="item-principal">Tenants con email alias (Cloudflare)</span>
                  <span style={{ color: '#e2e8f0' }}>{email?.canales?.cloudflareEmailRouting?.tenantsConAlias ?? 0}</span>
                </div>
                <div className="admin-item-seguimiento">
                  <span className="item-principal">Usuarios con IMAP propio</span>
                  <span style={{ color: '#e2e8f0' }}>{email?.canales?.imapPorUsuario ?? 0}</span>
                </div>
                <div className="admin-item-seguimiento">
                  <span className="item-principal">Facturas por email (7 días / total)</span>
                  <span style={{ color: '#e2e8f0' }}>
                    {email?.ingesta?.facturasPorEmail7d ?? 0} / {email?.ingesta?.facturasPorEmailTotal ?? 0}
                  </span>
                </div>
                <div className="admin-item-seguimiento">
                  <span className="item-principal">Facturas con error de procesamiento</span>
                  <span className={(email?.ingesta?.facturasConError || 0) > 0 ? 'admin-error-text' : 'admin-ok-text'}>
                    {email?.ingesta?.facturasConError ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback del chat */}
          <div className="admin-panel">
            <h2>
              Feedback del chat IA — {feedback?.resumen?.positivo || 0} positivos, {feedback?.resumen?.negativo || 0} negativos
              ({feedback?.negativos30d || 0} negativos en 30 días)
            </h2>
            <div className="admin-lista-seguimiento">
              {(feedback?.feedback || []).map((f) => (
                <div key={f._id} className="admin-item-seguimiento">
                  <div className="item-principal" style={{ whiteSpace: 'normal' }}>
                    {f.mensajeUsuario}
                    {f.comentario && <div className="item-meta">Comentario: {f.comentario}</div>}
                    <div className="item-meta">
                      {formatearFecha(f.createdAt)} · {f.usuario?.nombre || 'Usuario'} {f.modelo ? `· ${f.modelo}` : ''}
                    </div>
                  </div>
                  <span className={`admin-badge admin-badge--${f.feedback}`}>{f.feedback}</span>
                </div>
              ))}
              {(feedback?.feedback || []).length === 0 && (
                <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Aún no hay feedback del chat registrado.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
