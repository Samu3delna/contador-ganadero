import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { obtenerEstadoSuscripcionAPI, crearCheckoutAPI } from '../services/api';
import { PLANES } from '../data/planes';
import PlanCard from '../components/billing/PlanCard';
import './PlanesPage.css';

export default function PlanesPage() {
  const [planActual, setPlanActual] = useState(undefined);
  const [cargando, setCargando] = useState(true);
  const [procesandoPlan, setProcesandoPlan] = useState(null);

  useEffect(() => {
    obtenerEstadoSuscripcionAPI()
      .then(res => setPlanActual(res.data?.tenant?.plan || res.data?.plan))
      .catch(() => { /* quizá sin sesion aún */ })
      .finally(() => setCargando(false));
  }, []);

  const handleSeleccionar = async (planId) => {
    if (planId === 'free') {
      toast('El plan Free se gestiona al cancelar la suscripción desde el portal de Stripe.', { icon: 'i' });
      return;
    }
    setProcesandoPlan(planId);
    const toastId = toast.loading('Redirigiendo a Stripe...');
    try {
      const res = await crearCheckoutAPI(planId);
      toast.dismiss(toastId);
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        toast.error('No se recibió la URL de checkout.');
        setProcesandoPlan(null);
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.response?.data?.error || 'Error al iniciar el checkout.');
      setProcesandoPlan(null);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Planes</h1>
          <p className="page-subtitle">Elige el plan que mejor se adapta a tu finca</p>
        </div>
      </div>

      {cargando ? (
        <div className="loader-center"><div className="loader" /></div>
      ) : (
        <div className="planes-grid">
          {PLANES.map(plan => (
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
          <div className="loader" /> Procesando redirección a Stripe...
        </div>
      )}
    </div>
  );
}
