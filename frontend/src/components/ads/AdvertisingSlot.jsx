import { Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './AdvertisingSlot.css';

/**
 * Ranura publicitaria controlada por el plan del usuario.
 *
 * Regla por plan:
 *   - free -> muestra el espacio publicitario (placeholder para AdSense / proveedor).
 *   - pro / agro (y entornos sin sesión, salvo que se pase `mostrarPublico`) -> no muestra nada.
 *
 * Cuando se integre Google AdSense, basta reemplazar el contenido del slot por:
 *   <ins class="adsbygoogle"
 *        data-ad-client={import.meta.env.VITE_ADSENSE_CLIENT}
 *        data-ad-slot={import.meta.env.VITE_ADSENSE_SLOT}
 *        data-ad-format="auto"
 *        data-full-width-responsive="true" />
 * y empujar el push de `adsbygoogle`.
 */
export default function AdvertisingSlot({ mostrarPublico = false, tamaño = 'banner' }) {
  const { usuario } = useAuth();

  if (!usuario && !mostrarPublico) return null;

  const plan = usuario?.plan || usuario?.tenant?.plan;
  const planGratis = !usuario || plan === 'free';
  if (!planGratis) return null;

  const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT;
  const adsenseSlot = import.meta.env.VITE_ADSENSE_SLOT;

  return (
    <aside
      className={`advertising-slot advertising-slot--${tamaño}`}
      data-testid="ad-slot"
      aria-label="Publicidad"
    >
      <div className="advertising-slot-label">
        <Megaphone size={14} /> Publicidad
      </div>
      <div className="advertising-slot-body">
        {adsenseClient && adsenseSlot ? (
          <div className="advertising-slot-adsense">Slot configurado ({adsenseSlot})</div>
        ) : (
          <div className="advertising-slot-placeholder">
            Espacio publicitario reservado. Los planes Pro y Agro no lo muestran.
          </div>
        )}
      </div>
    </aside>
  );
}
