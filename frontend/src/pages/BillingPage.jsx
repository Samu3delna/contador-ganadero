import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { obtenerEstadoSuscripcionAPI, crearPortalAPI } from '../services/api';
import UsageBar from '../components/billing/UsageBar';
import { CreditCard, Crown, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';
import './BillingPage.css';

const PLAN_NOMBRES = {
  free: 'Free',
  bronce: 'Bronce',
  oro: 'Oro',
  corporativo: 'Corporativo',
};

const ESTADO_LABEL = {
  activo: { texto: 'Activo', clase: 'badge-exito' },
  suspendido: { texto: 'Suspendido', clase: 'badge-error' },
  periodo_gracia: { texto: 'Período de gracia', clase: 'badge-advertencia' },
  cancelado: { texto: 'Cancelado', clase: 'badge-error' },
};

function formatFecha(fecha) {
  if (!fecha) return '—';
  try {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return String(fecha);
  }
}

export default function BillingPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [abriendoPortal, setAbriendoPortal] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await obtenerEstadoSuscripcionAPI();
      setEstado(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cargar el estado');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handlePortal = async () => {
    setAbriendoPortal(true);
    const toastId = toast.loading('Abriendo portal de Stripe...');
    try {
      const res = await crearPortalAPI();
      toast.dismiss(toastId);
      const url = res.data?.url;
      if (url) window.location.href = url;
      else toast.error('No se recibió la URL del portal.');
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.response?.data?.error || 'Error al abrir el portal de Stripe.');
    } finally {
      setAbriendoPortal(false);
    }
  };

  if (cargando) {
    return <div className="page-content"><div className="loader-center"><div className="loader" /></div></div>;
  }

  const tenant = estado?.tenant || {};
  const plan = tenant.plan || 'free';
  const planNombre = PLAN_NOMBRES[plan] || plan;
  const estadoTenant = tenant.estado || 'activo';
  const estadoInfo = ESTADO_LABEL[estadoTenant] || { texto: estadoTenant, clase: 'badge-advertencia' };
  const limites = tenant.limites || {};
  const consumo = tenant.consumoActual || {};
  const periodoRenovacion = tenant.periodoRenovacion;
  const esFree = plan === 'free';

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi Suscripción</h1>
          <p className="page-subtitle">Estado de tu plan y consumo del mes en curso</p>
        </div>
        <button className="btn btn-secondary" onClick={cargar} title="Recargar">
          <RefreshCw size={16} /> Recargar
        </button>
      </div>

      {estadoTenant !== 'activo' && (
        <div className="billing-alerta">
          <AlertTriangle size={18} />
          <div>
            <strong>Acceso limitado.</strong> Tu suscripción está <strong>{estadoInfo.texto.toLowerCase()}</strong>.
            Algunas funciones pueden estar restringidas.{' '}
            <span className="billing-alerta-link" onClick={() => navigate('/billing')}>
              Revisa tu suscripción
            </span>
            .
          </div>
        </div>
      )}

      <div className="billing-grid">
        <section className="glass-card billing-section">
          <div className="billing-section-head">
            <h3>Plan actual</h3>
            <span className={`badge ${estadoInfo.clase}`}>{estadoInfo.texto}</span>
          </div>

          <div className="billing-plan">
            <span className="billing-plan-icon"><Crown size={22} /></span>
            <div>
              <div className="billing-plan-nombre">{planNombre}</div>
              <div className="billing-plan-finca">{tenant.nombreFinca || 'Tu finca'}</div>
            </div>
          </div>

          <div className="billing-plan-row">
            <span className="billing-plan-label">Próxima renovación</span>
            <span className="billing-plan-valor">{esFree ? 'Sin renovación' : formatFecha(periodoRenovacion)}</span>
          </div>
        </section>

        <section className="glass-card billing-section">
          <div className="billing-section-head">
            <h3>Uso del mes</h3>
          </div>

          <UsageBar
            consumo={consumo.conteosMes || 0}
            limite={limites.conteosMes || 0}
            label="Conteos visuales IA"
          />
          <UsageBar
            consumo={consumo.tokensChatMes || 0}
            limite={limites.tokensChatMes || 0}
            label="Tokens del chat IA"
          />
          <UsageBar
            consumo={consumo.almacenamientoMB || 0}
            limite={limites.almacenamientoMB || 0}
            label="Almacenamiento (MB)"
          />
        </section>
      </div>

      <section className="glass-card billing-acciones">
        {esFree ? (
          <div className="billing-cta">
            <div>
              <h3>Sube de plan y desbloquea todo</h3>
              <p>Accede a más conteos, VLM y soporte prioritario.</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/planes')}>
              Haz upgrade <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => navigate('/planes')}>
              <CreditCard size={16} /> Cambiar de plan
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePortal}
              disabled={abriendoPortal}
            >
              <Crown size={16} /> Administrar suscripción (Stripe Portal)
            </button>
          </>
        )}
      </section>
    </div>
  );
}
