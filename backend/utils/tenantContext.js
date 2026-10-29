/**
 * Contexto asíncrono de organización (Tenant) por petición usando AsyncLocalStorage.
 * Garantiza que todas las consultas de Mongoose dentro de una petición HTTP
 * conozcan automáticamente el tenantId validado en el middleware de autenticación.
 */

const { AsyncLocalStorage } = require('node:async_hooks');

const tenantStorage = new AsyncLocalStorage();

/**
 * Ejecuta una función dentro de un contexto de tenant explícito.
 * @param {{ tenantId: any, usuarioId?: any, rol?: string, isSuperAdmin?: boolean, skipTenant?: boolean }} context
 * @param {Function} fn
 */
function runWithTenantContext(context, fn) {
  return tenantStorage.run(context, fn);
}

/**
 * Obtiene el almacén actual del contexto asíncrono.
 * @returns {{ tenantId?: any, usuarioId?: any, rol?: string, isSuperAdmin?: boolean, skipTenant?: boolean } | undefined}
 */
function getTenantStore() {
  return tenantStorage.getStore();
}

/**
 * Obtiene el tenantId activo en el contexto asíncrono actual.
 * @returns {any | null}
 */
function getCurrentTenantId() {
  const store = tenantStorage.getStore();
  return store?.tenantId || null;
}

/**
 * Middleware Express o helper para establecer el contexto en la cadena actual
 * usando enterWith() para mantener compatibilidad con middlewares que llaman a next().
 * @param {{ tenantId?: any, usuarioId?: any, rol?: string, isSuperAdmin?: boolean, skipTenant?: boolean }} context
 */
function enterTenantContext(context) {
  tenantStorage.enterWith(context);
}

module.exports = {
  tenantStorage,
  runWithTenantContext,
  getTenantStore,
  getCurrentTenantId,
  enterTenantContext,
};
