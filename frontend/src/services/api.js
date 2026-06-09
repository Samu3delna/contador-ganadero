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
export const actualizarPerfilAPI = (datos) => api.put('/auth/perfil', datos);
export const cambiarPasswordAPI = (datos) => api.put('/auth/cambiar-password', datos);

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
export const sincronizarEmailAPI = (soloNoLeidos = true) => api.post('/facturas/email/sincronizar', { soloNoLeidos });
export const sincronizarEmailCompletoAPI = () => api.post('/facturas/email/sincronizar', { soloNoLeidos: false });

// === Descarga de archivos XML / PDF ===
// Usamos una función helper que maneja correctamente los errores con responseType: 'blob'
async function descargarArchivo(url) {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    return res;
  } catch (err) {
    // Cuando responseType es 'blob', los errores JSON del servidor llegan como Blob
    if (err.response?.data instanceof Blob) {
      const texto = await err.response.data.text();
      try {
        const json = JSON.parse(texto);
        err.response.data = json;
      } catch { /* no era JSON */ }
    }
    throw err;
  }
}

export const descargarXML_API = (id) => descargarArchivo(`/facturas/${id}/xml`);
export const descargarPDF_API = (id) => descargarArchivo(`/facturas/${id}/pdf`);

// === Alertas de tarifa agropecuaria ===
export const obtenerAlertasTarifaAPI = () => api.get('/facturas/alertas-tarifa');

// === Gastos Manuales ===
export const crearGastoManualAPI = (datos) => api.post('/facturas/manual', datos);

// === Impuestos ===
export const calcularIVA_API = (cuatrimestre, anio) => api.get(`/impuestos/iva/${cuatrimestre}/${anio}`);
export const calcularRentaAPI = (anio) => api.get(`/impuestos/renta/${anio}`);
export const proyeccionAPI = () => api.get('/impuestos/proyeccion');

// === Declaraciones ===
export const obtenerConfigFiscalAPI = () => api.get('/declaraciones/configuracion');
export const actualizarConfigFiscalAPI = (datos) => api.put('/declaraciones/configuracion', datos);
export const obtenerResumenDeclaracionAPI = (params) => api.get('/declaraciones/resumen', { params });
export const obtenerGastosDeduciblesAPI = (params) => api.get('/declaraciones/gastos', { params });
export const obtenerIngresosDeclaracionAPI = (params) => api.get('/declaraciones/ingresos', { params });
export const exportarDatosAPI = (params) => api.get('/declaraciones/exportar', { params, responseType: 'blob' });

// CRUD declaraciones guardadas
export const listarDeclaracionesAPI = (params) => api.get('/declaraciones', { params });
export const generarDeclaracionAPI = (datos) => api.post('/declaraciones', datos);
export const obtenerDeclaracionAPI = (id) => api.get(`/declaraciones/${id}`);
export const actualizarEstadoDeclaracionAPI = (id, datos) => api.put(`/declaraciones/${id}/estado`, datos);
export const eliminarDeclaracionAPI = (id) => api.delete(`/declaraciones/${id}`);

// === Deducibilidad ===
export const actualizarDeducibilidadAPI = (id, datos) => api.put(`/facturas/${id}/deducibilidad`, datos);

// === Dashboard ===
export const resumenDashboardAPI = () => api.get('/dashboard/resumen');
export const gastosPorCategoriaAPI = (anio) => api.get('/dashboard/gastos-por-categoria', { params: { anio } });
export const tendenciaMensualAPI = (anio) => api.get('/dashboard/tendencia-mensual', { params: { anio } });

// === Chat IA ===
export const chatAPI = (mensaje, historial) => api.post('/chat', { mensaje, historial });

// === Inventario ===
export const obtenerInventarioAPI = () => api.get('/inventario');
export const obtenerResumenInventarioAPI = () => api.get('/inventario/resumen');
export const agregarBovinoAPI = (datos) => api.post('/inventario/bovinos', datos);
export const actualizarBovinoAPI = (id, datos) => api.put(`/inventario/bovinos/${id}`, datos);
export const eliminarBovinoAPI = (id) => api.delete(`/inventario/bovinos/${id}`);
export const agregarLoteAvesAPI = (datos) => api.post('/inventario/aves', datos);
export const actualizarLoteAvesAPI = (id, datos) => api.put(`/inventario/aves/${id}`, datos);
export const eliminarLoteAvesAPI = (id) => api.delete(`/inventario/aves/${id}`);
export const agregarEstanqueAPI = (datos) => api.post('/inventario/peces', datos);
export const actualizarEstanqueAPI = (id, datos) => api.put(`/inventario/peces/${id}`, datos);
export const eliminarEstanqueAPI = (id) => api.delete(`/inventario/peces/${id}`);
export const agregarColmenaAPI = (datos) => api.post('/inventario/colmenas', datos);
export const actualizarColmenaAPI = (id, datos) => api.put(`/inventario/colmenas/${id}`, datos);
export const eliminarColmenaAPI = (id) => api.delete(`/inventario/colmenas/${id}`);

// === Costos de Producción ===
export const obtenerCostosAPI = (params) => api.get('/costos', { params });
export const obtenerResumenCostosAPI = (params) => api.get('/costos/resumen', { params });
export const crearCentroCostoAPI = (datos) => api.post('/costos/centros', datos);
export const agregarConsumoAPI = (refId, datos) => api.post(`/costos/centros/${refId}/consumo`, datos);
export const agregarProduccionAPI = (refId, datos) => api.post(`/costos/centros/${refId}/produccion`, datos);
export const cerrarCentroCostoAPI = (refId) => api.put(`/costos/centros/${refId}/cerrar`);

// === Facturación Electrónica REA ===
export const obtenerFacturasEmisionAPI = (params) => api.get('/facturacion', { params });
export const obtenerFacturaEmisionAPI = (id) => api.get(`/facturacion/${id}`);
export const crearFacturaEmisionAPI = (datos) => api.post('/facturacion', datos);
export const actualizarEstadoFacturaAPI = (id, datos) => api.put(`/facturacion/${id}/estado`, datos);
export const anularFacturaAPI = (id) => api.put(`/facturacion/${id}/anular`);
export const obtenerResumenEmisionAPI = (params) => api.get('/facturacion/resumen', { params });

export default api;
