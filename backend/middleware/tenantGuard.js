const Tenant = require('../models/Tenant');

/**
 * Middleware que extrae y valida el Tenant del request.
 * Debe ejecutarse DESPUES de authMiddleware.protegerRuta.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const extraerTenant = async (req, res, next) => {
  try {
    const tenantId = req.usuario?.tenantId || req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'SIN_TENANT', mensaje: 'Token sin tenant asociado' });
    }

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(401).json({ error: 'TENANT_INVALIDO', mensaje: 'Tenant no existe' });
    }

    if (tenant.estado === 'suspendido') {
      return res.status(402).json({
        error: 'SUSCRIPCION_SUSPENDIDA',
        planActual: tenant.plan,
        estado: tenant.estado,
      });
    }

    if (tenant.estado === 'cancelado') {
      return res.status(402).json({ error: 'SUSCRIPCION_CANCELADA' });
    }

    req.tenant = tenant;

    /**
     * Construye un filtro de consulta scoped al tenant actual.
     * @param {object} extra - campos adicionales del filtro
     * @returns {object} filtro MongoDB
     */
    req.filtrarPorTenant = (extra = {}) => ({
      tenantId: req.tenant._id,
      ...extra,
    });

    /**
     * Asigna tenantId a un documento antes de guardarlo.
     * @param {object} doc - documento Mongoose o objeto plano
     * @returns {object} el mismo doc con tenantId asignado
     */
    req.aplicarTenant = (doc) => {
      doc.tenantId = req.tenant._id;
      return doc;
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { extraerTenant };
