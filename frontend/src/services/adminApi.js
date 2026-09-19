import api from './api';

// === Métricas globales ===
export const obtenerResumenAdminAPI = () => api.get('/admin/resumen');

// === Gestión de usuarios ===
export const listarUsuariosAPI = (params) => api.get('/admin/usuarios', { params });
export const obtenerUsuarioAPI = (id) => api.get(`/admin/usuarios/${id}`);
export const actualizarUsuarioAPI = (id, datos) => api.put(`/admin/usuarios/${id}`, datos);
export const cambiarSuspensionUsuarioAPI = (id, suspendido) => api.put(`/admin/usuarios/${id}/suspension`, { suspendido });
export const resetPasswordUsuarioAPI = (id) => api.put(`/admin/usuarios/${id}/reset-password`);
export const eliminarUsuarioAPI = (id) => api.delete(`/admin/usuarios/${id}`);

// === Gestión de tenants y planes ===
export const listarTenantsAPI = (params) => api.get('/admin/tenants', { params });
export const obtenerTenantAPI = (id) => api.get(`/admin/tenants/${id}`);
export const cambiarPlanTenantAPI = (id, plan) => api.put(`/admin/tenants/${id}/plan`, { plan });
export const cambiarEstadoTenantAPI = (id, estado) => api.put(`/admin/tenants/${id}/estado`, { estado });
export const resetearConsumoTenantAPI = (id) => api.post(`/admin/tenants/${id}/resetear-consumo`);

// === Monitoreo operativo ===
export const monitoreoEventosOnvoAPI = (limit = 50) => api.get('/admin/monitoreo/eventos-onvo', { params: { limit } });
export const monitoreoChatFeedbackAPI = (limit = 50) => api.get('/admin/monitoreo/chat-feedback', { params: { limit } });
export const monitoreoEmailAPI = () => api.get('/admin/monitoreo/email');
export const monitoreoSaludAPI = () => api.get('/admin/monitoreo/salud');
