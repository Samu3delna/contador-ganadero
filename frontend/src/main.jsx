import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

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

