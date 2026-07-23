const Stripe = require('stripe');
const Tenant = require('../models/Tenant');
const SubscriptionEvent = require('../models/SubscriptionEvent');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

/**
 * Mapeo priceId -> plan (free|bronce|oro|corporativo)
 * Cargado desde variables de entorno STRIPE_PRICE_*
 */
const PRICE_TO_PLAN = {
  [process.env.STRIPE_PRICE_FREE || 'price_free']: 'free',
  [process.env.STRIPE_PRICE_BRONCE || 'price_bronce']: 'bronce',
  [process.env.STRIPE_PRICE_ORO || 'price_oro']: 'oro',
  [process.env.STRIPE_PRICE_CORPORATIVO || 'price_corporativo']: 'corporativo',
};

const PLAN_TO_PRICE = {
  free: process.env.STRIPE_PRICE_FREE,
  bronce: process.env.STRIPE_PRICE_BRONCE,
  oro: process.env.STRIPE_PRICE_ORO,
  corporativo: process.env.STRIPE_PRICE_CORPORATIVO,
};

const obtenerPlanPorPriceId = (priceId) => {
  return PRICE_TO_PLAN[priceId] || 'free';
};

const obtenerPeriodoActual = () => {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * @desc    Crear Stripe Checkout Session para upgrade de plan
 * @route   POST /api/stripe/checkout
 * @access  Privado (requiere tenant + dueño)
 */
const crearSesionCheckout = async (req, res, next) => {
  try {
    const { planId } = req.body;
    if (!['bronce', 'oro', 'corporativo'].includes(planId)) {
      res.status(400);
      throw new Error('planId inválido. Debe ser: bronce, oro o corporativo');
    }

    const priceId = PLAN_TO_PRICE[planId];
    if (!priceId || priceId.startsWith('price_') === false && !priceId.startsWith('price_')) {
      if (!priceId) {
        res.status(500);
        throw new Error(`Price ID no configurado para el plan ${planId}. Revisa STRIPE_PRICE_${planId.toUpperCase()} en .env`);
      }
    }

    const tenant = req.tenant;

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.usuario.email,
        name: req.usuario.nombre,
        metadata: {
          tenantId: tenant._id.toString(),
          nombreFinca: tenant.nombreFinca || '',
        },
      });
      customerId = customer.id;
      tenant.stripeCustomerId = customerId;
      await tenant.save();
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL || `${process.env.FRONTEND_URL}/planes?status=success`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${process.env.FRONTEND_URL}/planes?status=cancel`,
      metadata: {
        tenantId: tenant._id.toString(),
        planId,
        usuarioId: req.usuario._id.toString(),
      },
      subscription_data: {
        metadata: {
          tenantId: tenant._id.toString(),
          planId,
        },
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Crear Stripe Customer Portal URL para gestionar suscripción
 * @route   POST /api/stripe/portal
 * @access  Privado (requiere tenant + dueño)
 */
const crearPortalCliente = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    if (!tenant.stripeCustomerId) {
      res.status(400);
      throw new Error('Aún no tienes una suscripción de Stripe asociada. Suscríbete primero a un plan de pago.');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/billing` : `${process.env.STRIPE_SUCCESS_URL || ''}/billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Obtener estado de la suscripción del tenant actual
 * @route   GET /api/stripe/estado
 * @access  Privado (requiere tenant)
 */
const obtenerEstadoSuscripcion = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    let suscripcionStripe = null;

    if (tenant.stripeSubscriptionId) {
      try {
        suscripcionStripe = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
      } catch (err) {
        console.warn('No se pudo recuperar suscripción de Stripe:', err.message);
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
      stripe: suscripcionStripe ? {
        id: suscripcionStripe.id,
        status: suscripcionStripe.status,
        current_period_end: suscripcionStripe.current_period_end,
        cancel_at_period_end: suscripcionStripe.cancel_at_period_end,
      } : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Procesar webhook Stripe (raw body, sin json parser)
 * @route   POST /api/stripe/webhook
 * @access  Público (valida firma Stripe)
 */
const webhookStripe = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Firma de webhook Stripe inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const { created: createdResult, event: existenteEvent } = await SubscriptionEvent.registrarSiNoExiste({
      stripeEventId: event.id,
      type: event.type,
      data: event.data,
      stripeCustomerId: event.data?.object?.customer,
      stripeSubscriptionId: event.data?.object?.subscription || event.data?.object?.id,
    });

    if (!createdResult) {
      return res.json({ received: true, duplicate: true });
    }

    await procesarEventoStripe(event, existenteEvent);
    return res.json({ received: true });
  } catch (err) {
    console.error('Error procesando webhook Stripe:', err.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR', mensaje: err.message });
  }
};

/**
 * Lógica interna: procesar un evento Stripe y actualizar el Tenant correspondiente
 */
const procesarEventoStripe = async (event, subscriptionEvent) => {
  const objetoEvento = event.data?.object;
  if (!objetoEvento) {
    await subscriptionEvent.marcarError('Evento sin object');
    return;
  }

  const stripeCustomerId = objetoEvento.customer || objetoEvento.id;

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = objetoEvento;
      const tenantId = session.metadata?.tenantId;
      const planId = session.metadata?.planId;
      const subscriptionId = session.subscription;

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        await subscriptionEvent.marcarError(`Tenant ${tenantId} no encontrado`);
        return;
      }

      tenant.stripeCustomerId = stripeCustomerId;
      tenant.stripeSubscriptionId = subscriptionId;

      if (planId && ['free', 'bronce', 'oro', 'corporativo'].includes(planId)) {
        tenant.aplicarPlan(planId);
      }

      tenant.estado = 'activo';
      tenant.resetearConsumo();
      tenant.periodoRenovacion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tenant.save();

      subscriptionEvent.tenantId = tenant._id;
      await subscriptionEvent.marcarProcesado(tenant._id);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = objetoEvento;
      const tenantId = subscription.metadata?.tenantId;
      const priceId = subscription.items?.data?.[0]?.price?.id;

      const tenant = tenantId
        ? await Tenant.findById(tenantId)
        : await Tenant.findOne({ stripeSubscriptionId: subscription.id });

      if (!tenant) {
        await subscriptionEvent.marcarError(`Tenant no encontrado para subscription ${subscription.id}`);
        return;
      }

      tenant.stripeSubscriptionId = subscription.id;
      if (priceId) {
        const nuevoPlan = obtenerPlanPorPriceId(priceId);
        tenant.aplicarPlan(nuevoPlan);
      }

      if (subscription.status === 'active') {
        tenant.estado = 'activo';
      } else if (subscription.status === 'past_due') {
        tenant.estado = 'periodo_gracia';
        tenant.periodoGraciaFin = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      } else if (subscription.status === 'canceled') {
        tenant.estado = 'cancelado';
        tenant.canceladoEn = new Date();
        tenant.aplicarPlan('free');
      }

      await tenant.save();
      await subscriptionEvent.marcarProcesado(tenant._id);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = objetoEvento;
      const subscriptionId = invoice.subscription;
      const tenant = await Tenant.findOne({ stripeSubscriptionId: subscriptionId });

      if (!tenant) {
        await subscriptionEvent.marcarError(`Tenant no encontrado para subscription ${subscriptionId}`);
        return;
      }

      tenant.estado = 'activo';
      tenant.resetearConsumo();
      tenant.periodoRenovacion = invoice.period_end ? new Date(invoice.period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tenant.save();

      await subscriptionEvent.marcarProcesado(tenant._id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = objetoEvento;
      const subscriptionId = invoice.subscription;
      const tenant = await Tenant.findOne({ stripeSubscriptionId: subscriptionId });

      if (!tenant) {
        await subscriptionEvent.marcarError(`Tenant no encontrado para subscription ${subscriptionId}`);
        return;
      }

      tenant.estado = 'periodo_gracia';
      tenant.periodoGraciaFin = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      tenant.suspendidoEn = new Date();
      await tenant.save();

      await subscriptionEvent.marcarProcesado(tenant._id);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = objetoEvento;
      const tenant = await Tenant.findOne({ stripeSubscriptionId: subscription.id });

      if (!tenant) {
        await subscriptionEvent.marcarError(`Tenant no encontrado para subscription ${subscription.id}`);
        return;
      }

      tenant.estado = 'cancelado';
      tenant.canceladoEn = new Date();
      tenant.aplicarPlan('free');
      tenant.stripeSubscriptionId = null;
      await tenant.save();

      await subscriptionEvent.marcarProcesado(tenant._id);
      break;
    }

    default: {
      const tenantId = objetoEvento.metadata?.tenantId;
      if (tenantId) {
        subscriptionEvent.tenantId = tenantId;
      }
      await subscriptionEvent.marcarProcesado(tenantId || null);
    }
  }
};

module.exports = {
  crearSesionCheckout,
  crearPortalCliente,
  obtenerEstadoSuscripcion,
  webhookStripe,
};
