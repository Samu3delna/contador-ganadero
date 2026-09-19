/**
 * Tests para controllers/onvoController.js (webhookOnvo)
 */

const mongoose = require('mongoose');

// === Config env antes de importar el controller ===
process.env.ONVO_SECRET_KEY = 'onvo_test_secret_key_123';
process.env.ONVO_PUBLISHABLE_KEY = 'onvo_test_publishable_key_123';
process.env.ONVO_WEBHOOK_SECRET = 'webhook_secret_test_123';
process.env.ONVO_PRICE_FREE = 'price_free';
process.env.ONVO_PRICE_PRO = 'price_pro';
process.env.ONVO_PRICE_AGRO = 'price_agro';
process.env.FRONTEND_URL = 'http://localhost:5173';

// === Mock del servicio ONVO (no se llama a la API real) ===
jest.mock('../services/onvoService', () => ({
  crearCliente: jest.fn(),
  crearSuscripcion: jest.fn(),
  obtenerSuscripcion: jest.fn(),
  cancelarSuscripcion: jest.fn(),
}));
const onvoService = require('../services/onvoService');

const Tenant = require('../models/Tenant');
const SubscriptionEvent = require('../models/SubscriptionEvent');
const { webhookOnvo } = require('../controllers/onvoController');

const SECRET = 'webhook_secret_test_123';

const buildEventoRenovacion = (overrides = {}) => ({
  type: 'subscription.renewal.succeeded',
  data: {
    id: 'clinv_test_' + Math.random().toString(36).slice(2, 10),
    subscriptionId: 'clsub_test_123',
    customerId: 'clcus_test_123',
    status: 'paid',
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    metadata: {
      tenantId: null,
      planId: 'pro',
    },
    ...overrides,
  },
});

const buildReqRes = (body, secret = SECRET) => {
  const req = { body, headers: { 'x-webhook-secret': secret } };
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
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

describe('controllers/onvoController - webhookOnvo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('(a) secreto inválido -> 401 WEBHOOK_NO_AUTORIZADO', async () => {
    const { req, res } = buildReqRes({ type: 'x', data: {} }, 'secreto_incorrecto');
    await webhookOnvo(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'WEBHOOK_NO_AUTORIZADO' })
    );
  });

  test('(b) evento ya procesado -> {received:true, duplicate:true}', async () => {
    const tenant = await crearTenantPrueba();
    const event = buildEventoRenovacion();
    event.data.metadata.tenantId = tenant._id.toString();
    const eventoId = `${event.type}:${event.data.id}`;

    await SubscriptionEvent.create({
      eventoId,
      type: event.type,
      data: event.data,
      procesado: true,
    });

    const { req, res } = buildReqRes(event);
    await webhookOnvo(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, duplicate: true })
    );

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('free');
  });

  test('(c) subscription.renewal.succeeded nuevo -> activa plan y vincula ONVO', async () => {
    const tenant = await crearTenantPrueba();
    const event = buildEventoRenovacion();
    event.data.metadata.tenantId = tenant._id.toString();
    event.data.metadata.planId = 'pro';

    const { req, res } = buildReqRes(event);
    await webhookOnvo(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true })
    );

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('pro');
    expect(t.estado).toBe('activo');
    expect(t.onvoCustomerId).toBe('clcus_test_123');
    expect(t.onvoSubscriptionId).toBe('clsub_test_123');

    const ev = await SubscriptionEvent.findOne({ eventoId: `${event.type}:${event.data.id}` });
    expect(ev.procesado).toBe(true);
  });

  test('(d) idempotencia: mismo evento dos veces -> segunda duplicate', async () => {
    const tenant = await crearTenantPrueba();
    const event = buildEventoRenovacion();
    event.data.metadata.tenantId = tenant._id.toString();
    event.data.metadata.planId = 'agro';
    const eventoId = `${event.type}:${event.data.id}`;

    const { req: req1, res: res1 } = buildReqRes(event);
    await webhookOnvo(req1, res1);
    expect(res1.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true })
    );

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('agro');

    // Segunda vez con el mismo evento
    const { req: req2, res: res2 } = buildReqRes(event);
    await webhookOnvo(req2, res2);
    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, duplicate: true })
    );

    const evCount = await SubscriptionEvent.countDocuments({ eventoId });
    expect(evCount).toBe(1);
  });

  test('(e) cambio de plan: cancela la suscripción anterior en ONVO', async () => {
    const tenant = await crearTenantPrueba();
    tenant.onvoSubscriptionId = 'clsub_vieja_123';
    await tenant.save();

    const event = buildEventoRenovacion();
    event.data.subscriptionId = 'clsub_nueva_456';
    event.data.metadata.tenantId = tenant._id.toString();
    event.data.metadata.planId = 'agro';

    const { req, res } = buildReqRes(event);
    await webhookOnvo(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true })
    );
    expect(onvoService.cancelarSuscripcion).toHaveBeenCalledWith('clsub_vieja_123');

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('agro');
    expect(t.onvoSubscriptionId).toBe('clsub_nueva_456');
  });

  test('(f) subscription.renewal.failed -> tenant en periodo_gracia', async () => {
    const tenant = await crearTenantPrueba();
    tenant.plan = 'pro';
    tenant.limites = Tenant.obtenerLimitesPlan('pro');
    tenant.onvoSubscriptionId = 'clsub_test_123';
    await tenant.save();

    const event = {
      type: 'subscription.renewal.failed',
      data: {
        subscriptionId: 'clsub_test_123',
        paymentIntentId: 'clpiment_fail_1',
        subscriptionStatus: 'past_due',
        metadata: { tenantId: tenant._id.toString(), planId: 'pro' },
      },
    };

    const { req, res } = buildReqRes(event);
    await webhookOnvo(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true })
    );

    const t = await Tenant.findById(tenant._id);
    expect(t.estado).toBe('periodo_gracia');
    expect(t.periodoGraciaFin).toBeTruthy();
  });
});
