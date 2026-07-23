import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { obtenerEstadoSuscripcionAPI, crearCheckoutAPI } from '../services/api';
import PlanCard from '../components/billing/PlanCard';
import './PlanesPage.css';

const PLANES = [
  {
    id: 'free',
    nombre: 'Free',
    precio: 0,
    descripcion: 'Para empezar a probar la plataforma',
    caracteristicas: [
      { texto: '5 conteos visuales al mes', incluido: true },
      { texto: '1 usuario', incluido: true },
      { texto: '100MB de almacenamiento', incluido: true },
      { texto: 'Conteos por visión (VLM)', incluido: false },
      { texto: 'Soporte prioritario', incluido: false },
    ],
    limiteConteos: '5',
    limiteUsuarios: 1,
    almacenamiento: '100MB',
    vlm: false,
  },
  {
    id: 'bronce',
    nombre: 'Bronce',
    precio: 19,
    descripcion: 'Para fincas pequeñas en crecimiento',
    caracteristicas: [
      { texto: '100 conteos visuales al mes', incluido: true },
      { texto: '1 usuario', incluido: true },
      { texto: '5GB de almacenamiento', incluido: true },
      { texto: 'Soporte por email', incluido: true },
      { texto: 'Conteos por visión (VLM)', incluido: false },
    ],
    limiteConteos: '100',
    limiteUsuarios: 1,
    almacenamiento: '5GB',
    vlm: false,
  },
  {
    id: 'oro',
    nombre: 'Oro',
    precio: 49,
    descripcion: 'Para fincas medianas con más necesidades',
    caracteristicas: [
      { texto: '500 conteos visuales al mes', incluido: true },
      { texto: '3 usuarios incluidos', incluido: true },
      { texto: '25GB de almacenamiento', incluido: true },
      { texto: 'Conteos por visión (VLM)', incluido: true },
      { texto: 'Soporte prioritario', incluido: true },
    ],
    limiteConteos: '500',
    limiteUsuarios: 3,
    almacenamiento: '25GB',
    vlm: true,
    destacado: true,
  },
  {
    id: 'corporativo',
    nombre: 'Corporativo',
    precio: 199,
    descripcion: 'Para grandes operaciones y cooperativas',
    caracteristicas: [
      { texto: '5.000 conteos visuales al mes', incluido: true },
      { texto: '10 usuarios incluidos', incluido: true },
      { texto: '200GB de almacenamiento', incluido: true },
      { texto: 'Conteos por visión (VLM)', incluido: true },
      { texto: 'Soporte VIP dedicado', incluido: true },
    ],
    limiteConteos: '5.000',
    limiteUsuarios: 10,
    almacenamiento: '200GB',
    vlm: true,
  },
];

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
