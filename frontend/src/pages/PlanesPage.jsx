import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { obtenerEstadoSuscripcionAPI, crearCheckoutAPI, obtenerPlanesAPI } from '../services/api';
import { PLANES as PLANES_FALLBACK } from '../data/planes';
import PlanCard from '../components/billing/PlanCard';
import OnvoCheckoutModal from '../components/billing/OnvoCheckoutModal';
import '../components/billing/OnvoCheckoutModal.css';
import './PlanesPage.css';

export default function PlanesPage() {
  const [planActual, setPlanActual] = useState(undefined);
  const [planes, setPlanes] = useState(PLANES_FALLBACK);
  const [cargando, setCargando] = useState(true);
  const [procesandoPlan, setProcesandoPlan] = useState(null);
  const [checkout, setCheckout] = useState(null);

  const refrescarPlan = useCallback(async () => {
    const estadoRes = await obtenerEstadoSuscripcionAPI().catch(() => null);
    const plan = estadoRes?.data?.tenant?.plan || estadoRes?.data?.plan;
    if (plan) setPlanActual(plan);
    return plan;
  }, []);

  useEffect(() => {
    const cargarTodo = async () => {
      try {
        const [planesRes] = await Promise.all([
          obtenerPlanesAPI().catch(() => null),
          refrescarPlan(),
        ]);
        if (planesRes?.data?.planes?.length) {
          setPlanes(planesRes.data.planes);
        }
      } catch {
        /* silencioso: se fallback a planes locales */
      } finally {
        setCargando(false);
      }
    };
    cargarTodo();
  }, [refrescarPlan]);

  const handleSeleccionar = async (planId) => {
    if (planId === 'free') {
      toast('El plan Gratis se activa al cancelar tu suscripción desde "Mi Suscripción".', { icon: 'i' });
      return;
    }
    setProcesandoPlan(planId);
    const toastId = toast.loading('Preparando el formulario de pago...');
    try {
      const res = await crearCheckoutAPI(planId);
      toast.dismiss(toastId);
      const { subscriptionId, customerId, publicKey } = res.data || {};
      if (!subscriptionId || !customerId || !publicKey) {
        toast.error('Respuesta incompleta del servidor de pagos.');
        setProcesandoPlan(null);
        return;
      }
      const plan = planes.find(p => p.id === planId);
      setCheckout({ subscriptionId, customerId, publicKey, planNombre: plan?.nombre || planId });
      setProcesandoPlan(null);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.response?.data?.error || 'Error al iniciar el checkout.');
      setProcesandoPlan(null);
    }
  };

  // Tras el pago exitoso, el webhook de ONVO activa el plan en segundos;
  // consultamos el estado unas veces hasta reflejarlo.
  const handlePagoExitoso = async () => {
    const planObjetivo = planes.find(p => p.nombre === checkout?.planNombre)?.id;
    setCheckout(null);
    toast.success('¡Pago procesado! Activando tu plan...');
    for (let intento = 0; intento < 5; intento++) {
      await new Promise(r => setTimeout(r, 2000));
      const plan = await refrescarPlan();
      if (!planObjetivo || plan === planObjetivo) {
        toast.success(`Tu plan ${checkout?.planNombre || ''} ya está activo.`);
        return;
      }
    }
    toast('El plan se activará en unos segundos. Recarga la página si no lo ves.', { icon: 'i' });
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Planes</h1>
          <p className="page-subtitle">
            Tres planes pensados para tu finca. El plan Gratis tiene anuncios; Pro y Agro no.
          </p>
        </div>
      </div>

      {cargando ? (
        <div className="loader-center"><div className="loader" /></div>
      ) : (
        <div className="planes-grid">
          {planes.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              planActual={planActual}
              onSeleccionar={handleSeleccionar}
              disabled={procesandoPlan === plan.id}
            />
          ))}
        </div>
      )}

      {procesandoPlan && (
        <div className="planes-procesando">
          <div className="loader" /> Preparando pago con ONVO Pay...
        </div>
      )}

      <OnvoCheckoutModal
        checkout={checkout}
        onExito={handlePagoExitoso}
        onCerrar={() => setCheckout(null)}
      />
    </div>
  );
}
