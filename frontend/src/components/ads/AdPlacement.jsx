import { useEffect, useRef, useState } from 'react';
import { loadAdSense } from './adsenseLoader';
import './AdvertisingSlot.css';

export default function AdPlacement({ client, slot }) {
  const ref = useRef(null);
  const requested = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadAdSense(client).then(() => {
      if (!active || !ref.current || requested.current) return;
      requested.current = true;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
      catch { setFailed(true); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [client]);
  if (failed) return null;
  return <aside className="advertising-slot" aria-label="Publicidad">
    <span className="advertising-slot-label">Publicidad</span>
    <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={client}
      data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
  </aside>;
}
