/**
 * Helper y configuración para la detección de Administradores / Super Administradores.
 */

// Variable con los correos autorizados como Administrador por defecto.
// Se puede extender mediante la variable de entorno VITE_ADMIN_EMAILS (separada por comas).
export const CORREOS_ADMINISTRADOR = [
  'admin@admin.admin',
  'samu3delgado@gmail.com',
  'admin@contadorganadero.com',
  ...(import.meta.env.VITE_ADMIN_EMAILS ? import.meta.env.VITE_ADMIN_EMAILS.split(',') : []),
]
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

/**
 * Condición para determinar si un usuario o correo ingresado es Administrador.
 *
 * Cumple si:
 * 1. Tiene el flag esSuperAdmin o isSuperAdmin en true.
 * 2. Su rol es 'admin', 'administrador' o 'superadmin'.
 * 3. Su correo electrónico está en la lista de CORREOS_ADMINISTRADOR.
 * 4. Su correo electrónico empieza por 'admin@'.
 *
 * @param {object|null} usuario - Objeto de usuario o respuesta de sesión
 * @param {string} [emailFallback] - Correo electrónico ingresado en el formulario de login
 * @returns {boolean}
 */
export const esAdministrador = (usuario, emailFallback = '') => {
  const email = (usuario?.email || emailFallback || '').trim().toLowerCase();
  const rol = (usuario?.rol || '').trim().toLowerCase();

  return Boolean(
    usuario?.esSuperAdmin === true ||
    usuario?.isSuperAdmin === true ||
    rol === 'admin' ||
    rol === 'administrador' ||
    rol === 'superadmin' ||
    CORREOS_ADMINISTRADOR.includes(email) ||
    email.startsWith('admin@')
  );
};
