const SCRIPT_ID = 'cg-adsense-loader';
let pending;

/** Only called from an eligible placement. Concurrent requests share one script. */
export function loadAdSense(client, doc = document) {
  if (!/^ca-pub-\d{16}$/.test(client)) return Promise.reject(new Error('Editor inválido'));
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const existing = doc.getElementById(SCRIPT_ID);
    if (existing?.dataset.loaded === 'true') { resolve(); return; }
    const script = existing || doc.createElement('script');
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
    script.addEventListener('error', () => {
      script.remove(); pending = undefined; reject(new Error('No se pudo cargar AdSense'));
    }, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      doc.head.appendChild(script);
    }
  });
  return pending;
}
