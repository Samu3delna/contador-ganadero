/**
 * Valida que el usuario autenticado sea dueno del tenant actual.
 * Cumple si rol === 'dueño' o si el usuario es el owner del tenant.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const esDueñoTenant = (req, res, next) => {
  const usuario = req.usuario;
  const tenant = req.tenant;

  const esDuenoRol = usuario?.rol === 'dueño';
  const esOwner = !!(tenant?.owner && usuario?._id && tenant.owner.equals(usuario._id));

  if (!esDuenoRol && !esOwner) {
    return res.status(403).json({
      error: 'NO_ES_DUENO',
      rol: usuario?.rol,
    });
  }

  next();
};

const CORREOS_ADMIN_DEFAULT = [
  'admin@admin.admin',
];

/**
 * Determina si un email pertenece a un Super Admin.
 * Fuente de verdad: process.env.SUPER_ADMIN_EMAILS (CSV) o correos administradores por defecto.
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

  return (
    permitidos.includes(emailLimpio) ||
    CORREOS_ADMIN_DEFAULT.includes(emailLimpio)
  );
};

/**
 * Valida que el usuario sea Super Admin.
 * Cumple si su email esta en process.env.SUPER_ADMIN_EMAILS (CSV) / lista admin,
 * o si tiene flag isSuperAdmin / rol admin o administrador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const esSuperAdmin = (req, res, next) => {
  const usuario = req.usuario;
  const enLista = esEmailSuperAdmin(usuario?.email);
  const flagFuturo = usuario?.isSuperAdmin === true || usuario?.esSuperAdmin === true;
  const rolAdmin = usuario?.rol === 'admin' || usuario?.rol === 'administrador';

  if (!enLista && !flagFuturo && !rolAdmin) {
    return res.status(403).json({ error: 'NO_SUPER_ADMIN' });
  }

  next();
};

module.exports = { esDueñoTenant, esSuperAdmin, esEmailSuperAdmin };
