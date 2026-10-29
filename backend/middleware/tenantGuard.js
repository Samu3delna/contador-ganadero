const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const { enterTenantContext } = require('../utils/tenantContext');

/**
 * Middleware que extrae y valida el Tenant del request.
 * Debe ejecutarse DESPUÉS de authMiddleware.protegerRuta.
 * Fail-closed: elimina por completo el tenant demo offline (66554433221100aabbccddff)
 * y sincroniza el tenantId validado en AsyncLocalStorage.
 */
const extraerTenant = async (req, res, next) => {
  try {
    // Nunca tomar tenantId de req.body, req.query ni req.params
    const tenantId = req.usuario?.tenantId || req.auth?.tenantId;
    if (!tenantId || !mongoose.Types.ObjectId.isValid(String(tenantId))) {
      return res.status(401).json({
        error: 'SIN_TENANT',
        mensaje: 'El usuario no tiene una finca (tenant) asociada.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'SERVICIO_NO_DISPONIBLE',
        mensaje: 'Servicio temporalmente no disponible.',
      });
    }

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(401).json({
        error: 'TENANT_INVALIDO',
        mensaje: 'La finca (tenant) asociada no existe.',
      });
    }

    if (tenant.estado === 'suspendido') {
      return res.status(402).json({
        error: 'SUSCRIPCION_SUSPENDIDA',
        mensaje: 'La suscripción de tu finca está suspendida por falta de pago.',
        planActual: tenant.plan,
        estado: tenant.estado,
      });
    }

    if (tenant.estado === 'cancelado') {
      return res.status(402).json({
        error: 'SUSCRIPCION_CANCELADA',
        mensaje: 'La suscripción de tu finca ha sido cancelada.',
        planActual: tenant.plan,
        estado: tenant.estado,
      });
    }

    req.tenant = tenant;

    if (typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'no-store');
    }

    // Reforzar el contexto de tenant en AsyncLocalStorage
    enterTenantContext({
      tenantId: tenant._id,
      usuarioId: req.usuario?._id,
      rol: req.usuario?.rol,
      isSuperAdmin: Boolean(req.usuario?.isSuperAdmin),
    });

    /**
     * Construye un filtro de consulta scoped al tenant actual (mantenido por compatibilidad).
     * @param {object} extra - campos adicionales del filtro
     * @returns {object} filtro MongoDB
     */
    req.filtrarPorTenant = (extra = {}) => ({
      ...extra,
      tenantId: req.tenant._id,
    });

    /**
     * Asigna tenantId a un documento antes de guardarlo (mantenido por compatibilidad).
     * @param {object} doc - documento Mongoose o objeto plano
     * @returns {object} el mismo doc con tenantId asignado
     */
    req.aplicarTenant = (doc) => {
      if (doc && typeof doc === 'object') {
        doc.tenantId = req.tenant._id;
      }
      return doc;
    };

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { extraerTenant };
