
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

// ===== Google Analytics 4 (GA4) =====
// Se activa solo si VITE_GA4_ID está definido (ej. en .env: VITE_GA4_ID=G-XXXXXXXXXX).
// Si no existe, no se inyecta nada y no rompe en desarrollo.
const ga4Id = import.meta.env.VITE_GA4_ID;
if (ga4Id) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args) => { window.dataLayer.push(args); };
  gtag('js', new Date());
  gtag('config', ga4Id);
  window.gtag = gtag;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--color-superficie, #1e293b)',
          color: 'var(--color-texto, #e2e8f0)',
          border: '1px solid var(--color-borde, #334155)',
          borderRadius: '12px',
          fontSize: '0.9rem',
        },
        success: {
          iconTheme: { primary: '#22c55e', secondary: '#0f172a' },
        },
        error: {
          duration: 5000,
          iconTheme: { primary: '#ef4444', secondary: '#0f172a' },
        },
      }}
    />
  </StrictMode>,
)

