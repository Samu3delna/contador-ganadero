import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: agregar token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: manejar errores 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// === Auth ===
export const loginAPI = (datos) => api.post('/auth/login', datos);
export const registroAPI = (datos) => api.post('/auth/registro', datos);
export const obtenerPerfilAPI = () => api.get('/auth/perfil');

// === Ingresos ===
export const obtenerIngresosAPI = (params) => api.get('/ingresos', { params });
export const crearIngresoAPI = (datos) => api.post('/ingresos', datos);
export const actualizarIngresoAPI = (id, datos) => api.put(`/ingresos/${id}`, datos);
export const eliminarIngresoAPI = (id) => api.delete(`/ingresos/${id}`);

// === Facturas ===
export const obtenerFacturasAPI = (params) => api.get('/facturas', { params });
export const obtenerFacturaAPI = (id) => api.get(`/facturas/${id}`);
export const actualizarCategoriaAPI = (id, datos) => api.put(`/facturas/${id}/categoria`, datos);
export const eliminarFacturaAPI = (id) => api.delete(`/facturas/${id}`);
export const estadoEmailAPI = () => api.get('/facturas/email/estado');
export const sincronizarEmailAPI = () => api.post('/facturas/email/sincronizar');

// === Descarga de archivos XML / PDF ===
export const descargarXML_API = (id) => api.get(`/facturas/${id}/xml`, { responseType: 'blob' });
export const descargarPDF_API = (id) => api.get(`/facturas/${id}/pdf`, { responseType: 'blob' });

// === Alertas de tarifa agropecuaria ===
export const obtenerAlertasTarifaAPI = () => api.get('/facturas/alertas-tarifa');

// === Impuestos ===
export const calcularIVA_API = (cuatrimestre, anio) => api.get(`/impuestos/iva/${cuatrimestre}/${anio}`);
export const calcularRentaAPI = (anio) => api.get(`/impuestos/renta/${anio}`);
export const proyeccionAPI = () => api.get('/impuestos/proyeccion');

// === Dashboard ===
export const resumenDashboardAPI = () => api.get('/dashboard/resumen');
export const gastosPorCategoriaAPI = (anio) => api.get('/dashboard/gastos-por-categoria', { params: { anio } });
export const tendenciaMensualAPI = (anio) => api.get('/dashboard/tendencia-mensual', { params: { anio } });

export default api;
