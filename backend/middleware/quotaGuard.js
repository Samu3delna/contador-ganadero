/**
 * Valida que el tenant del request este activo (activo | periodo_gracia).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requiereTenantActivo = (req, res, next) => {
  if (!req.tenant || !req.tenant.estaActivo()) {
    return res.status(402).json({
      error: 'TENANT_INACTIVO',
      estado: req.tenant?.estado,
    });
  }
  next();
};

/**
 * Valida que el tenant tenga credito disponible para conteos visuales IA.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requiereCreditoConteo = (req, res, next) => {
  if (!req.tenant || !req.tenant.tieneCreditoConteo()) {
    return res.status(429).json({
      error: 'CUOTA_CONTEOS_AGOTADA',
      planActual: req.tenant?.plan,
      limite: req.tenant?.limites?.conteosMes,
      consumo: req.tenant?.consumoActual?.conteosMes,
    });
  }
  next();
};

/**
 * Valida que el tenant tenga credito de tokens disponible para el chat IA.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requiereCreditoChat = (req, res, next) => {
  if (!req.tenant || !req.tenant.tieneCreditoChat()) {
    return res.status(429).json({
      error: 'CUOTA_CHAT_AGOTADA',
      planActual: req.tenant?.plan,
      limite: req.tenant?.limites?.tokensChatMes,
      consumo: req.tenant?.consumoActual?.tokensChatMes,
    });
  }
  next();
};

/**
 * Valida que el plan del tenant incluya acceso al modulo contable/fiscal.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requiereFeatureModuloContable = (req, res, next) => {
  if (!req.tenant || req.tenant.limites?.moduloContable !== true) {
    return res.status(403).json({
      error: 'PLAN_SIN_ACCESO_MODULO',
      planActual: req.tenant?.plan,
    });
  }
  next();
};

/**
 * Valida que el plan del tenant tenga VLM (vision-language models) habilitado.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requiereFeatureVLM = (req, res, next) => {
  if (!req.tenant || req.tenant.limites?.vlmHabilitado !== true) {
    return res.status(403).json({
      error: 'PLAN_SIN_VLM',
      planActual: req.tenant?.plan,
    });
  }
  next();
};

module.exports = {
  requiereTenantActivo,
  requiereCreditoConteo,
  requiereCreditoChat,
  requiereFeatureModuloContable,
  requiereFeatureVLM,
};
