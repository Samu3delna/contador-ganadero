// Resolución de la URL base de la API (función pura, sin dependencias, testeable con node:test).
//
// En producción (Cloudflare Workers Static Assets) no existe proxy /api: si VITE_API_URL no se
// definió en el build, se usa la API de Render para que el login y demás llamadas no terminen
// en el SPA estático. En desarrollo se usa '/api' (proxy de Vite hacia http://localhost:5000).
export const API_URL_PRODUCCION = 'https://contador-ganadero.onrender.com/api';

export function resolverApiUrl(env = {}) {
  const configurada = typeof env.VITE_API_URL === 'string' ? env.VITE_API_URL.trim() : '';
  const base = configurada || (env.PROD ? API_URL_PRODUCCION : '/api');
  const sinBarraFinal = base.replace(/\/+$/, '');
  return sinBarraFinal.endsWith('/api') ? sinBarraFinal : `${sinBarraFinal}/api`;
}
