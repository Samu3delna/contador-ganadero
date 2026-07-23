import { Check, X, Crown, Sparkles, Eye, Users, HardDrive } from 'lucide-react';
import './PlanCard.css';

export default function PlanCard({ plan, planActual, onSeleccionar }) {
  const esActual = plan.id === planActual;
  const esFree = plan.id === 'free';
  const esDestacado = plan.destacado;

  // Texto del boton segun estado relativo al plan actual
  let textoBoton = 'Suscribirse';
  let claseBoton = 'plan-card-btn plan-card-btn--primario';
  let deshabilitado = false;

  if (esActual) {
    textoBoton = 'Plan actual';
    claseBoton = 'plan-card-btn plan-card-btn--actual';
    deshabilitado = true;
  } else if (esFree && planActual && planActual !== 'free') {
    textoBoton = 'Downgrade';
    claseBoton = 'plan-card-btn plan-card-btn--secundario';
  } else if (!esFree) {
    // Plan de pago y no actual
    textoBoton = planActual && planActual !== 'free' ? 'Hacer upgrade' : 'Suscribirse';
    claseBoton = 'plan-card-btn plan-card-btn--primario';
  }

  return (
    <div className={`plan-card ${esActual ? 'plan-card--actual' : ''} ${esDestacado ? 'plan-card--destacado' : ''}`}>
      {esDestacado && (
        <div className="plan-card-popular">
          <Crown size={14} /> Más popular
        </div>
      )}

      <div className="plan-card-head">
        <h3 className="plan-card-nombre">{plan.nombre}</h3>
        <p className="plan-card-descripcion">{plan.descripcion}</p>
      </div>

      <div className="plan-card-precio">
        {plan.precio === 0 ? (
          <>
            <span className="plan-card-precio-num">Gratis</span>
          </>
        ) : (
          <>
            <span className="plan-card-precio-sign">$</span>
            <span className="plan-card-precio-num">{plan.precio}</span>
            <span className="plan-card-precio-per">/ mes</span>
          </>
        )}
      </div>

      <div className="plan-card-badges">
        <span className="plan-badge" title="Conteos visuales por mes">
          <Eye size={12} /> {plan.limiteConteos} conteos/mes
        </span>
        <span className="plan-badge" title="Usuarios permitidos">
          <Users size={12} /> {plan.limiteUsuarios} {plan.limiteUsuarios === 1 ? 'usuario' : 'usuarios'}
        </span>
        <span className="plan-badge" title="Almacenamiento">
          <HardDrive size={12} /> {plan.almacenamiento}
        </span>
        {plan.vlm ? (
          <span className="plan-badge plan-badge--ok" title="Visión por Lenguaje (VLM)">
            <Sparkles size={12} /> VLM
          </span>
        ) : (
          <span className="plan-badge plan-badge--off" title="Sin VLM">
            <X size={12} /> Sin VLM
          </span>
        )}
      </div>

      <ul className="plan-card-features">
        {plan.caracteristicas.map((c, i) => (
          <li key={i} className={c.incluido ? 'plan-feature' : 'plan-feature plan-feature--off'}>
            {c.incluido ? <Check size={16} className="plan-feature-icon" /> : <X size={16} className="plan-feature-icon" />}
            <span>{c.texto}</span>
          </li>
        ))}
      </ul>

      <button
        className={claseBoton}
        onClick={() => !deshabilitado && onSeleccionar(plan.id)}
        disabled={deshabilitado}
      >
        {textoBoton}
      </button>
    </div>
  );
}
