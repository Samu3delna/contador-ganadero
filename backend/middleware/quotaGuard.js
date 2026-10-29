const Tenant = require('../models/Tenant');

/**
 * Valida que el tenant del request esté activo (activo | periodo_gracia).
 */
const requiereTenantActivo = (req, res, next) => {
  if (!req.tenant || typeof req.tenant.estaActivo !== 'function' || !req.tenant.estaActivo()) {
    return res.status(402).json({
      error: 'TENANT_INACTIVO',
      estado: req.tenant?.estado,
    });
  }
  return next();
};

/**
 * Valida que el tenant tenga crédito disponible para conteos visuales IA.
 * Si req.tenant es un documento Mongoose persistido, reserva el crédito de forma
 * atómica con findOneAndUpdate + $inc para impedir condiciones de carrera.
 */
const requiereCreditoConteo = (req, res, next) => {
  if (!req.tenant || typeof req.tenant.tieneCreditoConteo !== 'function' || !req.tenant.tieneCreditoConteo()) {
    return res.status(429).json({
      error: 'CUOTA_CONTEOS_AGOTADA',
      planActual: req.tenant?.plan,
      limite: req.tenant?.limites?.conteosMes,
      consumo: req.tenant?.consumoActual?.conteosMes,
    });
  }

  if (typeof req.tenant.save === 'function' && req.tenant._id) {
    const limite = req.tenant?.limites?.conteosMes ?? 0;
    return Tenant.findOneAndUpdate(
      {
        _id: req.tenant._id,
        estado: 'activo',
        'consumoActual.conteosMes': { $lt: limite },
      },
      { $inc: { 'consumoActual.conteosMes': 1 } },
      { new: true }
    )
      .then((actualizado) => {
        if (!actualizado) {
          return res.status(429).json({
            error: 'CUOTA_CONTEOS_AGOTADA',
            planActual: req.tenant?.plan,
            limite,
            consumo: req.tenant?.consumoActual?.conteosMes,
          });
        }
        req.tenant = actualizado;
        return next();
      })
      .catch(next);
  }

  return next();
};

/**
 * Valida que el tenant tenga crédito de tokens disponible para el chat IA.
 */
const requiereCreditoChat = (req, res, next) => {
  if (!req.tenant || typeof req.tenant.tieneCreditoChat !== 'function' || !req.tenant.tieneCreditoChat()) {
    return res.status(429).json({
      error: 'CUOTA_CHAT_AGOTADA',
      planActual: req.tenant?.plan,
      limite: req.tenant?.limites?.tokensChatMes,
      consumo: req.tenant?.consumoActual?.tokensChatMes,
    });
  }
  return next();
};

/**
 * Incrementa atómicamente el consumo de tokens de chat en base de datos.
 */
const consumirTokensChatAtomico = async (tenantId, tokensAIncrementar, limiteTokens) => {
  if (!tenantId || !tokensAIncrementar || tokensAIncrementar <= 0) return null;
  const filtro = { _id: tenantId, estado: { $in: ['activo', 'periodo_gracia'] } };
  if (typeof limiteTokens === 'number' && limiteTokens > 0) {
    filtro['consumoActual.tokensChatMes'] = { $lt: limiteTokens };
  }
  return Tenant.findOneAndUpdate(
    filtro,
    { $inc: { 'consumoActual.tokensChatMes': tokensAIncrementar } },
    { new: true }
  );
};

/**
 * Valida que el plan del tenant incluya acceso al módulo contable/fiscal.
 */
const requiereFeatureModuloContable = (req, res, next) => {
  if (!req.tenant || req.tenant.limites?.moduloContable !== true) {
    return res.status(403).json({
      error: 'PLAN_SIN_ACCESO_MODULO',
      planActual: req.tenant?.plan,
    });
  }
  return next();
};

/**
 * Valida que el plan del tenant tenga VLM (vision-language models) habilitado.
 */
const requiereFeatureVLM = (req, res, next) => {
  if (!req.tenant || req.tenant.limites?.vlmHabilitado !== true) {
    return res.status(403).json({
      error: 'PLAN_SIN_VLM',
      planActual: req.tenant?.plan,
    });
  }
  return next();
};

module.exports = {
  requiereTenantActivo,
  requiereCreditoConteo,
  requiereCreditoChat,
  consumirTokensChatAtomico,
  requiereFeatureModuloContable,
  requiereFeatureVLM,
};
