import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AD_POLICY, isAdEligible } from '../../config/adPolicy';
import AdPlacement from './AdPlacement';

/** Compatibility entry point. Unreviewed screens never mount a placement. */
export default function AdvertisingSlot({ consent = 'unknown', contentReady = false }) {
  const { usuario, cargando } = useAuth();
  const { pathname } = useLocation();
  const eligible = isAdEligible({
    pathname, user: usuario, authLoading: cargando, consent, contentReady,
    client: import.meta.env.VITE_ADSENSE_CLIENT, slot: import.meta.env.VITE_ADSENSE_SLOT,
  });
  if (!eligible) return null;
  return <AdPlacement key={pathname} client={AD_POLICY.publisher} slot={import.meta.env.VITE_ADSENSE_SLOT} />;
}
