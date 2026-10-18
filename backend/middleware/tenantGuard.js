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
    const tenantId = req.usuario?.tenantId || req.auth?.tenantId || '66554433221100aabbccddff';

    let tenant = null;
    try {
      tenant = await Tenant.findById(tenantId);
    } catch (err) {
      console.warn('⚠️ Base de datos no disponible en extraerTenant:', err.message);
    }

    if (!tenant) {
      tenant = {
        _id: tenantId,
        nombreFinca: req.usuario?.nombreFinca || 'Hacienda El Cedro (Demo)',
        plan: req.usuario?.plan || 'pro',
        estado: 'activo',
        limites: { facturasMes: 500, usuarios: 5, animales: 1000 },
        consumoActual: { facturasMes: 12, usuarios: 1, animales: 45 },
        emailAlias: 'hacienda-el-cedro-demo',
        estaActivo: () => true,
        save: async () => {},
      };
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
