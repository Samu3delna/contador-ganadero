const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const SubscriptionEvent = require('../models/SubscriptionEvent');
const { CATALOGO_PLANES, PLANES_VALIDOS } = require('../config/planes');
const onvo = require('../services/onvoService');

/**
 * Resuelve dinámicamente el priceId de ONVO para un plan desde variables de entorno.
 * Acepta tanto ONVO_PRICE_PRO como el alias ONVO_PRO_PRICE_ID por compatibilidad.
 */
const obtenerPriceIdPorPlan = (planId) => {
  if (planId === 'pro') {
    return process.env.ONVO_PRICE_PRO || process.env.ONVO_PRO_PRICE_ID;
  }
  if (planId === 'free') {
    return process.env.ONVO_PRICE_FREE;
  }
  return undefined;
};

/**
 * Convierte fechas de ONVO (ISO string, Unix segundos o Unix milisegundos) a Date válido.
 */
const parsearFechaOnvo = (valor, baseDate = new Date()) => {
  if (valor !== undefined && valor !== null && valor !== '') {
    let candidato;
    if (typeof valor === 'number' || /^\d+$/.test(String(valor).trim())) {
      const num = Number(valor);
      candidato = new Date(num < 1e12 ? num * 1000 : num);
    } else {
      candidato = new Date(valor);
    }
    if (!Number.isNaN(candidato.getTime()) && candidato.getFullYear() >= 2020) {
      return candidato;
    }
  }
  return new Date(baseDate.getTime() + 30 * 86400000);
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

    const priceId = obtenerPriceIdPorPlan(planId);
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

    tenant.onvoSubscriptionIdPendiente = suscripcion.id;
    tenant.onvoPriceId = priceId;
    await tenant.save();

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
    const tieneEstadoPagadoOInactivo = tenant.plan !== 'free' || tenant.estado !== 'activo';

    if (!tenant.onvoSubscriptionId && !tieneEstadoPagadoOInactivo) {
      res.status(400);
      throw new Error('No tienes una suscripción de ONVO Pay activa.');
    }

    if (tenant.onvoSubscriptionId) {
      try {
        await onvo.cancelarSuscripcion(tenant.onvoSubscriptionId);
      } catch (err) {
        // Si la suscripción ya no existe o ya estaba cancelada en ONVO (404), permitir bajar a free localmente
        if (err.status !== 404 && !/already cancel|not found|no encontrada/i.test(err.message || '')) {
          throw err;
        }
      }
    }

    tenant.onvoSubscriptionId = undefined;
    tenant.onvoSubscriptionIdPendiente = undefined;
    tenant.estado = 'activo';
    tenant.periodoGraciaFin = null;
    tenant.suspendidoEn = undefined;
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
 *          (incluye auto-conciliación si hay una suscripción recién activada en ONVO)
 * @route   GET /api/onvo/estado
 * @access  Privado (requiere tenant)
 */
const obtenerEstadoSuscripcion = async (req, res, next) => {
  try {
    let tenant = req.tenant;
    let suscripcionOnvo = null;
    const subIdAConsultar = tenant.onvoSubscriptionId || tenant.onvoSubscriptionIdPendiente;

    if (subIdAConsultar && process.env.ONVO_SECRET_KEY) {
      try {
        suscripcionOnvo = await onvo.obtenerSuscripcion(subIdAConsultar);
      } catch (err) {
        console.warn('No se pudo recuperar suscripción de ONVO:', err.message);
      }
    }

    // Auto-conciliación: si el SDK confirmó el pago y ONVO reporta la suscripción activa
    // antes de que llegue el webhook, activar el plan Pro de forma idempotente.
    if (
      suscripcionOnvo &&
      ['active', 'trialing'].includes(suscripcionOnvo.status) &&
      (tenant.plan !== 'pro' || tenant.estado !== 'activo' || tenant.onvoSubscriptionId !== suscripcionOnvo.id)
    ) {
      const syncKey = `sync:${suscripcionOnvo.id}:${suscripcionOnvo.currentPeriodEnd || suscripcionOnvo.periodEnd || 'active'}`;
      const fechaRenovacion = parsearFechaOnvo(
        suscripcionOnvo.currentPeriodEnd || suscripcionOnvo.periodEnd,
        new Date()
      );
      await Tenant.updateOne(
        { _id: tenant._id, onvoEventosAplicados: { $ne: syncKey } },
        {
          $set: {
            plan: 'pro',
            limites: Tenant.obtenerLimitesPlan('pro'),
            estado: 'activo',
            onvoSubscriptionId: suscripcionOnvo.id,
            onvoSubscriptionIdPendiente: null,
            onvoCustomerId: suscripcionOnvo.customerId || tenant.onvoCustomerId,
            periodoRenovacion: fechaRenovacion,
            periodoGraciaFin: null,
          },
          $addToSet: { onvoEventosAplicados: syncKey },
        },
        { runValidators: true }
      );
      const recargado = await Tenant.findById(tenant._id);
      if (recargado) tenant = recargado;
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
        currentPeriodEnd: suscripcionOnvo.currentPeriodEnd || suscripcionOnvo.periodEnd,
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
  const finPeriodo = data?.periodEnd || data?.currentPeriodEnd;
  const objetoId = data?.id || data?.paymentIntentId || (data?.subscriptionId && finPeriodo ? `${data.subscriptionId}:${finPeriodo}` : null);
  if (objetoId) return `${type}:${objetoId}`;
  const hash = crypto.createHash('sha256').update(JSON.stringify(data || {})).digest('hex');
  return `${type}:${hash}`;
};

/**
 * Busca el Tenant asociado a un evento ONVO usando, en orden:
 * metadata.tenantId -> subscriptionId (activa o pendiente) -> customerId.
 */
const buscarTenantParaEvento = async (datos) => {
  const tenantId = datos?.metadata?.tenantId;
  if (tenantId) {
    const porId = await Tenant.findById(tenantId).catch(() => null);
    if (porId) return porId;
  }
  if (datos?.subscriptionId) {
    const porSub = await Tenant.findOne({
      $or: [
        { onvoSubscriptionId: datos.subscriptionId },
        { onvoSubscriptionIdPendiente: datos.subscriptionId },
      ],
    });
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
    const { event: eventoGuardado } = await SubscriptionEvent.registrarSiNoExiste({
      eventoId: construirEventoId(type, data),
      type,
      data,
      customerId: data.customerId || data.customer?.id,
      subscriptionId: data.subscriptionId,
    });

    if (eventoGuardado.procesado) {
      return res.json({ received: true, duplicate: true });
    }
    const claimToken = crypto.randomUUID();
    const claim = await SubscriptionEvent.reclamar(eventoGuardado._id, claimToken);
    if (!claim) return res.status(503).json({ error: 'EVENTO_EN_PROCESO' });
    try {
      await procesarEventoOnvo(type, data, claim);
    } catch (error) {
      await SubscriptionEvent.updateOne({ _id: claim._id, claimToken },
        { $set: { error: 'No se pudo aplicar el evento' }, $unset: { claimToken: 1, claimHasta: 1 } }, { skipTenant: true });
      throw error;
    }
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
  const tenant = await buscarTenantParaEvento(datos);
  const esRenovacionExito = type === 'subscription.renewal.succeeded';
  const esRenovacionFallo = type === 'subscription.renewal.failed';
  const esPagoInicialSuscripcion =
    ['payment_intent.succeeded', 'payment-intent.succeeded'].includes(type) &&
    Boolean(datos?.subscriptionId || datos?.metadata?.planId || tenant?.onvoSubscriptionIdPendiente);

  if ((esRenovacionExito || esRenovacionFallo) && !tenant) {
    throw new Error('Tenant del evento no encontrado');
  }

  const eventoId = subscriptionEvent.eventoId;
  if (esRenovacionExito || esRenovacionFallo || (esPagoInicialSuscripcion && tenant)) {
    const cambios = {};
    if (esRenovacionExito || esPagoInicialSuscripcion) {
      const planId = datos.metadata?.planId || 'pro';
      if (!PLANES_VALIDOS.includes(planId)) throw new Error('Plan inválido');
      const subIdEfectivo = datos.subscriptionId || tenant.onvoSubscriptionIdPendiente || tenant.onvoSubscriptionId;
      cambios.plan = planId;
      cambios.limites = Tenant.obtenerLimitesPlan(planId);
      Object.assign(cambios, {
        estado: 'activo',
        ...(subIdEfectivo ? { onvoSubscriptionId: subIdEfectivo } : {}),
        onvoSubscriptionIdPendiente: null,
        onvoCustomerId: datos.customerId || datos.customer?.id || tenant.onvoCustomerId,
        periodoRenovacion: parsearFechaOnvo(datos.periodEnd || datos.currentPeriodEnd, subscriptionEvent.createdAt),
        periodoGraciaFin: null,
        'consumoActual.conteosMes': 0,
        'consumoActual.tokensChatMes': 0,
        'consumoActual.periodoActual': require('../utils/periodoCR').periodoCR(),
      });

      const aplicado = await Tenant.updateOne(
        { _id: tenant._id, onvoEventosAplicados: { $ne: eventoId } },
        { $set: cambios, $addToSet: { onvoEventosAplicados: eventoId } },
        { runValidators: true }
      );
      if (
        aplicado.modifiedCount &&
        subIdEfectivo &&
        tenant.onvoSubscriptionId &&
        tenant.onvoSubscriptionId !== subIdEfectivo
      ) {
        try { await onvo.cancelarSuscripcion(tenant.onvoSubscriptionId); }
        catch { console.warn('Cancelación de suscripción anterior requiere conciliación operativa'); }
      }
    } else {
      Object.assign(cambios, {
        estado: 'periodo_gracia',
        periodoGraciaFin: new Date(subscriptionEvent.createdAt.getTime() + 7 * 86400000),
        suspendidoEn: subscriptionEvent.createdAt,
      });
      await Tenant.updateOne(
        { _id: tenant._id, onvoEventosAplicados: { $ne: eventoId } },
        { $set: cambios, $addToSet: { onvoEventosAplicados: eventoId } },
        { runValidators: true }
      );
    }
  }
  await SubscriptionEvent.updateOne({ _id: subscriptionEvent._id, claimToken: subscriptionEvent.claimToken },
    { $set: { procesado: true, procesadoAt: new Date(), ...(tenant ? { tenantId: tenant._id } : {}) },
      $unset: { claimToken: 1, claimHasta: 1, error: 1 } }, { skipTenant: true });
};

// Called by the background process after a crash or a transient processing failure.
async function reconciliarEventosPendientes() {
  const pendientes = await SubscriptionEvent.find({ procesado: { $ne: true },
    $or: [{ claimHasta: { $exists: false } }, { claimHasta: null }, { claimHasta: { $lte: new Date() } }] }, null,
  { skipTenant: true }).sort({ createdAt: 1 }).limit(25);
  for (const evento of pendientes) {
    const token = crypto.randomUUID();
    const claim = await SubscriptionEvent.reclamar(evento._id, token);
    if (!claim) continue;
    try { await procesarEventoOnvo(claim.type, claim.data, claim); }
    catch {
      await SubscriptionEvent.updateOne({ _id: claim._id, claimToken: token },
        { $set: { error: 'Procesamiento pendiente', claimHasta: new Date(Date.now() + 60000) } }, { skipTenant: true });
    }
  }
}

module.exports = {
  crearSesionCheckout,
  cancelarSuscripcionTenant,
  obtenerEstadoSuscripcion,
  obtenerPlanes,
  webhookOnvo,
  reconciliarEventosPendientes,
};
