const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const SubscriptionEvent = require('../models/SubscriptionEvent');
const { CATALOGO_PLANES, PLANES_VALIDOS } = require('../config/planes');
const onvo = require('../services/onvoService');

/**
 * Mapeo plan -> priceId de ONVO (precios recurrentes creados en el Dashboard)
 * Cargado desde variables de entorno ONVO_PRICE_*
 */
const PLAN_TO_PRICE = {
  free: process.env.ONVO_PRICE_FREE,
  pro: process.env.ONVO_PRICE_PRO,
};

/**
 * @desc    Iniciar suscripción ONVO para upgrade de plan.
 *          Crea (si hace falta) el cliente ONVO y un cargo recurrente
 *          incompleto; el frontend lo confirma con el SDK web de ONVO.
 * @route   POST /api/onvo/checkout
 * @access  Privado (requiere tenant + dueño)
 */
const crearSesionCheckout = async (req, res, next) => {
  try {
    const { planId } = req.body;
    if (planId !== 'pro') {
      res.status(400);
      throw new Error('planId inválido. El único plan de pago es: pro');
    }

    const priceId = PLAN_TO_PRICE[planId];
    if (!priceId) {
      res.status(500);
      throw new Error(`Price ID no configurado para el plan ${planId}. Revisa ONVO_PRICE_${planId.toUpperCase()} en .env`);
    }

    const publicKey = process.env.ONVO_PUBLISHABLE_KEY;
    if (!publicKey) {
      res.status(500);
      throw new Error('ONVO_PUBLISHABLE_KEY no configurada en .env');
    }

    const tenant = req.tenant;

    let customerId = tenant.onvoCustomerId;
    if (!customerId) {
      const cliente = await onvo.crearCliente({
        email: req.usuario.email,
        nombre: req.usuario.nombre,
      });
      customerId = cliente.id;
      tenant.onvoCustomerId = customerId;
      await tenant.save();
    }

    const suscripcion = await onvo.crearSuscripcion({
      customerId,
      priceId,
      descripcion: `Plan ${planId} — ContadorGanadero`,
      metadata: {
        tenantId: tenant._id.toString(),
        planId,
        usuarioId: req.usuario._id.toString(),
      },
    });

    res.json({
      subscriptionId: suscripcion.id,
      customerId,
      publicKey,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancelar la suscripción ONVO del tenant y volver al plan free
 * @route   POST /api/onvo/cancelar
 * @access  Privado (requiere tenant + dueño)
 */
const cancelarSuscripcionTenant = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    if (!tenant.onvoSubscriptionId) {
      res.status(400);
      throw new Error('No tienes una suscripción de ONVO Pay activa.');
    }

    await onvo.cancelarSuscripcion(tenant.onvoSubscriptionId);

    tenant.onvoSubscriptionId = null;
    tenant.estado = 'cancelado';
    tenant.canceladoEn = new Date();
    tenant.aplicarPlan('free');
    await tenant.save();

    res.json({ ok: true, plan: tenant.plan, estado: tenant.estado });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Obtener estado de la suscripción del tenant actual
 * @route   GET /api/onvo/estado
 * @access  Privado (requiere tenant)
 */
const obtenerEstadoSuscripcion = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    let suscripcionOnvo = null;

    if (tenant.onvoSubscriptionId && process.env.ONVO_SECRET_KEY) {
      try {
        suscripcionOnvo = await onvo.obtenerSuscripcion(tenant.onvoSubscriptionId);
      } catch (err) {
        console.warn('No se pudo recuperar suscripción de ONVO:', err.message);
      }
    }

    res.json({
      tenant: {
        plan: tenant.plan,
        estado: tenant.estado,
        limites: tenant.limites,
        consumoActual: tenant.consumoActual,
        periodoRenovacion: tenant.periodoRenovacion,
        nombreFinca: tenant.nombreFinca,
      },
      onvo: suscripcionOnvo ? {
        id: suscripcionOnvo.id,
        status: suscripcionOnvo.status,
        currentPeriodEnd: suscripcionOnvo.currentPeriodEnd,
        cancelAtPeriodEnd: suscripcionOnvo.cancelAtPeriodEnd,
      } : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Obtener catálogo público de planes (precios, límites y anuncios)
 * @route   GET /api/onvo/planes
 * @access  Público
 */
const obtenerPlanes = async (req, res, next) => {
  try {
    res.json({ planes: CATALOGO_PLANES });
  } catch (error) {
    next(error);
  }
};

/**
 * Verifica el header X-Webhook-Secret de ONVO con comparación timing-safe.
 */
const secretoWebhookValido = (req) => {
  const esperado = process.env.ONVO_WEBHOOK_SECRET;
  if (!esperado) return false;
  const recibido = req.headers['x-webhook-secret'] || '';
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Construye una llave de idempotencia para un evento ONVO.
 * ONVO no envía un ID de evento global; usamos type + id del objeto.
 */
const construirEventoId = (type, data) => {
  const objetoId = data?.id || data?.paymentIntentId || data?.subscriptionId;
  if (objetoId) return `${type}:${objetoId}`;
  const hash = crypto.createHash('sha256').update(JSON.stringify(data || {})).digest('hex');
  return `${type}:${hash}`;
};

/**
 * Busca el Tenant asociado a un evento ONVO usando, en orden:
 * metadata.tenantId -> subscriptionId -> customerId.
 */
const buscarTenantParaEvento = async (datos) => {
  const tenantId = datos?.metadata?.tenantId;
  if (tenantId) {
    const porId = await Tenant.findById(tenantId).catch(() => null);
    if (porId) return porId;
  }
  if (datos?.subscriptionId) {
    const porSub = await Tenant.findOne({ onvoSubscriptionId: datos.subscriptionId });
    if (porSub) return porSub;
  }
  const customerId = datos?.customerId || datos?.customer?.id;
  if (customerId) {
    return Tenant.findOne({ onvoCustomerId: customerId });
  }
  return null;
};

/**
 * @desc    Procesar webhook ONVO (JSON normal; valida X-Webhook-Secret)
 * @route   POST /api/onvo/webhook
 * @access  Público (valida secreto ONVO)
 */
const webhookOnvo = async (req, res) => {
  if (!secretoWebhookValido(req)) {
    console.warn('Webhook ONVO rechazado: X-Webhook-Secret inválido o no configurado');
    return res.status(401).json({ error: 'WEBHOOK_NO_AUTORIZADO' });
  }

  const { type, data } = req.body || {};
  if (!type || !data) {
    return res.status(400).json({ error: 'PAYLOAD_INVALIDO' });
  }

  try {
    const { created: creado, event: eventoGuardado } = await SubscriptionEvent.registrarSiNoExiste({
      eventoId: construirEventoId(type, data),
      type,
      data,
      customerId: data.customerId || data.customer?.id,
      subscriptionId: data.subscriptionId,
    });

    if (!creado) {
      return res.json({ received: true, duplicate: true });
    }

    await procesarEventoOnvo(type, data, eventoGuardado);
    return res.json({ received: true });
  } catch (err) {
    console.error('Error procesando webhook ONVO:', err.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR', mensaje: err.message });
  }
};

/**
 * Lógica interna: procesar un evento ONVO y actualizar el Tenant correspondiente
 */
const procesarEventoOnvo = async (type, datos, subscriptionEvent) => {
  switch (type) {
    case 'subscription.renewal.succeeded': {
      const tenant = await buscarTenantParaEvento(datos);
      if (!tenant) {
        await subscriptionEvent.marcarError(`Tenant no encontrado para suscripción ${datos.subscriptionId}`);
        return;
      }

      // Si el tenant tenía otra suscripción activa (cambio de plan), cancelarla
      if (tenant.onvoSubscriptionId && tenant.onvoSubscriptionId !== datos.subscriptionId) {
        try {
          await onvo.cancelarSuscripcion(tenant.onvoSubscriptionId);
        } catch (err) {
          console.warn('No se pudo cancelar la suscripción anterior en ONVO:', err.message);
        }
      }

      tenant.onvoCustomerId = datos.customerId || tenant.onvoCustomerId;
      tenant.onvoSubscriptionId = datos.subscriptionId;

      const planId = datos.metadata?.planId;
      if (planId && PLANES_VALIDOS.includes(planId)) {
        tenant.aplicarPlan(planId);
      }

      tenant.estado = 'activo';
      tenant.resetearConsumo();
      tenant.periodoRenovacion = datos.periodEnd
        ? new Date(datos.periodEnd)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tenant.save();

      subscriptionEvent.tenantId = tenant._id;
      await subscriptionEvent.marcarProcesado(tenant._id);
      break;
    }

    case 'subscription.renewal.failed': {
      const tenant = await buscarTenantParaEvento(datos);
      if (!tenant) {
        await subscriptionEvent.marcarError(`Tenant no encontrado para suscripción ${datos.subscriptionId}`);
        return;
      }

      tenant.estado = 'periodo_gracia';
      tenant.periodoGraciaFin = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      tenant.suspendidoEn = new Date();
      await tenant.save();

      await subscriptionEvent.marcarProcesado(tenant._id);
      break;
    }

    default: {
      // payment-intent.*, checkout-session.succeeded, mobile-transfer.received, etc.
      // No requieren acción: las renovaciones gobiernan el estado del plan.
      const tenant = await buscarTenantParaEvento(datos);
      await subscriptionEvent.marcarProcesado(tenant?._id || null);
    }
  }
};

module.exports = {
  crearSesionCheckout,
  cancelarSuscripcionTenant,
  obtenerEstadoSuscripcion,
  obtenerPlanes,
  webhookOnvo,
};
