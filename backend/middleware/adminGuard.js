/**
 * Valida que el usuario autenticado sea dueño o admin del tenant actual.
 * Cumple si rol === 'dueño' | 'admin' o si el usuario es el owner del tenant.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const esDueñoTenant = (req, res, next) => {
  const usuario = req.usuario;
  const tenant = req.tenant;

  const esDuenoOAdminRol = usuario?.rol === 'dueño' || usuario?.rol === 'admin';
  const esOwner = !!(tenant?.owner && usuario?._id && typeof tenant.owner.equals === 'function' && tenant.owner.equals(usuario._id));

  if (!esDuenoOAdminRol && !esOwner) {
    return res.status(403).json({
      error: 'NO_ES_DUENO',
      rol: usuario?.rol,
    });
  }

  return next();
};

/**
 * Determina si un email está en la lista explícita de variables de entorno (solo para referencia operativa).
 * SEGURIDAD: Se eliminó 'admin@admin.admin' y cualquier correo fijo en código.
 * @param {string|undefined} email
 * @returns {boolean}
 */
const esEmailSuperAdmin = (email) => {
  const csv = process.env.SUPER_ADMIN_EMAILS || '';
  const permitidos = csv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const emailLimpio = (email || '').toString().trim().toLowerCase();
  if (!emailLimpio) return false;

  return permitidos.includes(emailLimpio);
};

/**
 * Valida que el usuario sea Super Admin de la plataforma.
 * SEGURIDAD:
 * - Separa estrictamente el rol dentro de un tenant ('dueño', 'admin') del rol de plataforma (isSuperAdmin).
 * - Un 'admin' de tenant NUNCA pasa esSuperAdmin.
 * - Solo pasa si usuario.isSuperAdmin === true (asignado por script de consola autenticado).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const esSuperAdmin = (req, res, next) => {
  const usuario = req.usuario;
  const esSuper = usuario?.isSuperAdmin === true || usuario?.esSuperAdmin === true;

  if (!esSuper) {
    return res.status(403).json({ error: 'NO_SUPER_ADMIN' });
  }

  // En producción, si REQUIRE_ADMIN_MFA=true, exige que el superadmin tenga MFA activo
  if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_ADMIN_MFA === 'true') {
    if (!usuario?.mfa?.enabled) {
      return res.status(403).json({
        error: 'MFA_REQUERIDO_SUPERADMIN',
        mensaje: 'El acceso de Super Admin requiere autenticación de dos factores (MFA) activa.',
      });
    }
  }

  return next();
};

module.exports = { esDueñoTenant, esSuperAdmin, esEmailSuperAdmin };
