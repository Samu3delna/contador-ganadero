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

/**
 * Valida que el usuario sea Super Admin.
 * Cumple si su email esta en process.env.SUPER_ADMIN_EMAILS (CSV)
 * o si tiene el flag futuro req.usuario.isSuperAdmin === true.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const esSuperAdmin = (req, res, next) => {
  const usuario = req.usuario;
  const csv = process.env.SUPER_ADMIN_EMAILS || '';
  const permitidos = csv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const emailUsuario = (usuario?.email || '').toString().toLowerCase();
  const enLista = permitidos.includes(emailUsuario);
  const flagFuturo = usuario?.isSuperAdmin === true;

  if (!enLista && !flagFuturo) {
    return res.status(403).json({ error: 'NO_SUPER_ADMIN' });
  }

  next();
};

module.exports = { esDueñoTenant, esSuperAdmin };
