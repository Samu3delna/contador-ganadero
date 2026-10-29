/**
 * Helper para la detección de Super Administradores en la interfaz.
 * La autorización real siempre se valida en el backend (middleware/adminGuard.js).
 * Nunca se confía en correos hardcodeados ni en variables VITE_ del cliente.
 */

export const CORREOS_ADMINISTRADOR = [];

/**
 * Determina si el objeto de sesión retornado por el backend corresponde a un Super Administrador.
 *
 * @param {object|null} usuario - Objeto de usuario autenticado devuelto por el servidor
 * @returns {boolean}
 */
export const esAdministrador = (usuario) => {
  const rol = (usuario?.rol || '').trim().toLowerCase();

  return Boolean(
    usuario?.esSuperAdmin === true ||
    usuario?.isSuperAdmin === true ||
    rol === 'superadmin'
  );
};
