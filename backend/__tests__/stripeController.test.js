/**
 * Tests para controllers/stripeController.js (webhookStripe)
 */

const mongoose = require('mongoose');

// === Mock del SDK stripe ===
let constructEventMock = jest.fn();
let customersCreateMock = jest.fn();
let checkoutSessionsCreateMock = jest.fn();
let subscriptionsRetrieveMock = jest.fn();
let billingPortalSessionsCreateMock = jest.fn();

const stripeInstance = {
  webhooks: { constructEvent: (...args) => constructEventMock(...args) },
  customers: { create: (...args) => customersCreateMock(...args) },
  checkout: { sessions: { create: (...args) => checkoutSessionsCreateMock(...args) } },
  subscriptions: { retrieve: (...args) => subscriptionsRetrieveMock(...args) },
  billingPortal: { sessions: { create: (...args) => billingPortalSessionsCreateMock(...args) } },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => stripeInstance);
});

// === Config env antes de importar el controller ===
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
process.env.STRIPE_PRICE_FREE = 'price_free';
process.env.STRIPE_PRICE_BRONCE = 'price_bronce';
process.env.STRIPE_PRICE_ORO = 'price_oro';
process.env.STRIPE_PRICE_CORPORATIVO = 'price_corporativo';
process.env.FRONTEND_URL = 'http://localhost:5173';

const Tenant = require('../models/Tenant');
const SubscriptionEvent = require('../models/SubscriptionEvent');
const { webhookStripe } = require('../controllers/stripeController');

const buildEvent = (overrides = {}) => ({
  id: 'evt_test_' + Math.random().toString(36).slice(2, 10),
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_123',
      customer: 'cus_test_123',
      subscription: 'sub_test_123',
      metadata: {
        tenantId: null,
        planId: 'bronce',
      },
    },
  },
  ...overrides,
});

const buildReqRes = (body) => {
  const req = { body, headers: { 'stripe-signature': 'sig_test' } };
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return { req, res };
};

async function crearTenantPrueba() {
  return Tenant.create({
    nombreFinca: 'Finca Prueba ' + Math.random().toString(36).slice(2, 6),
    plan: 'free',
    estado: 'activo',
    limites: Tenant.obtenerLimitesPlan('free'),
    owner: new mongoose.Types.ObjectId(),
  });
}

describe('controllers/stripeController - webhookStripe', () => {
  beforeEach(() => {
    constructEventMock.mockReset();
    customersCreateMock.mockReset();
  });

  test('(a) firma invalida -> constructEvent lanza -> 400', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const { req, res } = buildReqRes({ foo: 'bar' });
    await webhookStripe(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Webhook Error')
    );
  });

  test('(b) event.id ya procesado -> {received:true, duplicate:true}', async () => {
    const tenant = await crearTenantPrueba();
    const event = buildEvent({ id: 'evt_duplicado_' + Math.random().toString(36).slice(2, 8) });
    constructEventMock.mockReturnValue(event);

    await SubscriptionEvent.create({
      stripeEventId: event.id,
      type: event.type,
      data: event.data,
      procesado: true,
    });

    const { req, res } = buildReqRes('raw-body');
    await webhookStripe(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, duplicate: true })
    );

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('free');
  });

  test('(c) event.id nuevo tipo checkout.session.completed -> actualiza Tenant', async () => {
    const tenant = await crearTenantPrueba();
    const event = buildEvent({
      id: 'evt_checkout_' + Date.now() + Math.random().toString(36).slice(2, 6),
      type: 'checkout.session.completed',
    });
    event.data.object.metadata.tenantId = tenant._id.toString();
    event.data.object.metadata.planId = 'bronce';

    constructEventMock.mockReturnValue(event);

    const { req, res } = buildReqRes('raw-body');
    await webhookStripe(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true })
    );

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('bronce');
    expect(t.estado).toBe('activo');
    expect(t.stripeCustomerId).toBe('cus_test_123');
    expect(t.stripeSubscriptionId).toBe('sub_test_123');

    const ev = await SubscriptionEvent.findOne({ stripeEventId: event.id });
    expect(ev.procesado).toBe(true);
  });

  test('(d) Idempotencia: mismo event.id dos veces -> segunda duplicate', async () => {
    const tenant = await crearTenantPrueba();
    const event = buildEvent({
      id: 'evt_idempo_' + Date.now() + Math.random().toString(36).slice(2, 6),
      type: 'checkout.session.completed',
    });

    event.data.object.metadata.tenantId = tenant._id.toString();
    event.data.object.metadata.planId = 'oro';

    constructEventMock.mockReturnValue(event);

    const { req: req1, res: res1 } = buildReqRes('raw-1');
    await webhookStripe(req1, res1);
    expect(res1.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true })
    );

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('oro');

    // Segunda vez con mismo event.id
    const { req: req2, res: res2 } = buildReqRes('raw-2');
    await webhookStripe(req2, res2);
    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, duplicate: true })
    );

    const evCount = await SubscriptionEvent.countDocuments({ stripeEventId: event.id });
    expect(evCount).toBe(1);
  });
});
