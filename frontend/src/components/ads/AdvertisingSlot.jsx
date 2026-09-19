import { useEffect, useRef } from 'react';
import { Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './AdvertisingSlot.css';

/**
 * Ranura publicitaria controlada por el plan del usuario (Google AdSense).
 *
 * Regla por plan:
 *   - free: muestra el anuncio de AdSense (o placeholder en desarrollo).
 *   - pro: no muestra nada (experiencia limpia sin anuncios).
 */
export default function AdvertisingSlot({ mostrarPublico = false, tamaño = 'banner' }) {
  const { usuario } = useAuth();
  const adRef = useRef(null);

  const plan = usuario?.plan || usuario?.tenant?.plan;
  const planGratis = !usuario || plan === 'free';

  const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT;
  const adsenseSlot = import.meta.env.VITE_ADSENSE_SLOT;
  const tieneAdsense = adsenseClient && adsenseClient.startsWith('ca-pub-') && adsenseSlot;

  useEffect(() => {
    if (planGratis && tieneAdsense) {
      if (typeof window !== 'undefined') {
        // Garantizar que el script de AdSense esté presente en el DOM
        if (!document.querySelector('script[src*="pagead2.googlesyndication.com"]')) {
          const s = document.createElement('script');
          s.async = true;
          s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`;
          s.crossOrigin = 'anonymous';
          document.head.appendChild(s);
        }
        try {
          // Solo hacer push si este ins no ha sido procesado aún
          if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          }
        } catch (err) {
          console.warn('AdSense notice:', err.message);
        }
      }
    }
  }, [planGratis, tieneAdsense, adsenseClient]);

  if (!usuario && !mostrarPublico) return null;
  if (!planGratis) return null;
  if (!usuario && mostrarPublico && !tieneAdsense) return null;

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
        {tieneAdsense ? (
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={adsenseClient}
            data-ad-slot={adsenseSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <div className="advertising-slot-placeholder">
            Espacio publicitario reservado (Google AdSense). Los suscriptores Pro disfrutan la plataforma sin anuncios.
          </div>
        )}
      </div>
    </aside>
  );
}
