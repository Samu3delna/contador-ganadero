/**
 * Tests para controllers/onvoController.js (webhookOnvo)
 */

const mongoose = require('mongoose');

// === Config env antes de importar el controller ===
process.env.ONVO_SECRET_KEY = 'onvo_test_secret_key_123';
process.env.ONVO_PUBLISHABLE_KEY = 'onvo_test_publishable_key_123';
process.env.ONVO_WEBHOOK_SECRET = 'webhook_secret_zQzfNtqFFnodeTb2x';
process.env.ONVO_PRICE_FREE = 'price_free';
process.env.ONVO_PRICE_PRO = 'price_pro';
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

const SECRET = 'webhook_secret_zQzfNtqFFnodeTb2x';

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

  test('S-06: fallo antes del efecto permite reentrega del mismo evento', async () => {
    const tenant = await crearTenantPrueba();
    const event = buildEventoRenovacion(); event.data.metadata.tenantId = String(tenant._id);
    const spy = jest.spyOn(Tenant, 'updateOne').mockRejectedValueOnce(new Error('fallo transitorio'));
    const first = buildReqRes(event); await webhookOnvo(first.req, first.res);
    expect(first.res.status).toHaveBeenCalledWith(500); spy.mockRestore();
    const retry = buildReqRes(event); await webhookOnvo(retry.req, retry.res);
    expect(retry.res.json).toHaveBeenCalledWith({ received: true });
    expect((await Tenant.findById(tenant._id)).plan).toBe('pro');
  });

  test('S-06: fallo al cerrar evento no repite el efecto ni reinicia consumo', async () => {
    const tenant = await crearTenantPrueba();
    const event = buildEventoRenovacion(); event.data.metadata.tenantId = String(tenant._id);
    const spy = jest.spyOn(SubscriptionEvent, 'updateOne');
    spy.mockRejectedValueOnce(new Error('fallo despues del efecto'));
    const first = buildReqRes(event); await webhookOnvo(first.req, first.res); spy.mockRestore();
    await Tenant.updateOne({ _id: tenant._id }, { $set: { 'consumoActual.conteosMes': 9 } });
    const retry = buildReqRes(event); await webhookOnvo(retry.req, retry.res);
    expect((await Tenant.findById(tenant._id)).consumoActual.conteosMes).toBe(9);
    expect((await SubscriptionEvent.findOne({ eventoId: `${event.type}:${event.data.id}` })).procesado).toBe(true);
  });

  test('S-06: entregas concurrentes conservan un evento y un efecto', async () => {
    await SubscriptionEvent.init();
    const tenant = await crearTenantPrueba();
    const event = buildEventoRenovacion(); event.data.metadata.tenantId = String(tenant._id);
    const reqs = Array.from({ length: 5 }, () => buildReqRes(event));
    await Promise.all(reqs.map(({ req, res }) => webhookOnvo(req, res)));
    expect(await SubscriptionEvent.countDocuments({ eventoId: `${event.type}:${event.data.id}` })).toBe(1);
    const t = await Tenant.findById(tenant._id).select('+onvoEventosAplicados');
    expect(t.onvoEventosAplicados).toEqual([`${event.type}:${event.data.id}`]);
  });

  test('S-06: worker recupera un claim abandonado despues de reinicio', async () => {
    const tenant = await crearTenantPrueba(); const event=buildEventoRenovacion(); event.data.metadata.tenantId=String(tenant._id);
    await SubscriptionEvent.create({eventoId:`${event.type}:${event.data.id}`,type:event.type,data:event.data,claimToken:'proceso-muerto',claimHasta:new Date(0)});
    await require('../controllers/onvoController').reconciliarEventosPendientes();
    expect((await Tenant.findById(tenant._id)).plan).toBe('pro');
    expect((await SubscriptionEvent.findOne({eventoId:`${event.type}:${event.data.id}`})).procesado).toBe(true);
  });

  test('P-05: cancelar Pro permite perfil y refresh del plan gratuito', async () => {
    const request=require('supertest'), app=require('../server'), Usuario=require('../models/Usuario');
    const u=await Usuario.create({nombre:'Cancelar',email:'cancel@example.test',password:'SyntheticPassword123!',rol:'owner'});
    const t=await Tenant.crearParaUsuario({nombreFinca:'Gratis',owner:u._id,plan:'pro'});
    u.tenantId=t._id; await u.save(); t.onvoSubscriptionId='sub-cancel-test'; await t.save();
    const login=await request(app).post('/api/auth/login').send({email:u.email,password:'SyntheticPassword123!'});
    const token=login.body.token;
    expect((await request(app).post('/api/onvo/cancelar').set('Authorization',`Bearer ${token}`)).status).toBe(200);
    const perfil=await request(app).get('/api/auth/perfil').set('Authorization',`Bearer ${token}`);
    expect(perfil.status).toBe(200);expect(perfil.body.tenant.plan).toBe('free');
    const cookie=login.headers['set-cookie'].find(c=>c.startsWith('refreshToken=')).split(';')[0];
    expect((await request(app).post('/api/auth/refresh').set('Cookie',cookie)).status).toBe(200);
  });

  test('P-09/F-41: cambio mensual concurrente no borra consumos del mes nuevo y gracia vence', async () => {
    const tenant = await crearTenantPrueba();
    await Tenant.updateOne({ _id: tenant._id }, { $set: {
      'consumoActual.periodoActual': '2026-10', 'consumoActual.conteosMes': 10,
      'consumoActual.almacenamientoUsadoMB': 25, estado: 'periodo_gracia', periodoGraciaFin: new Date('2026-11-01T06:00:00Z'),
    } });
    const ahora = new Date('2026-11-01T06:00:00Z');
    await Promise.all(Array.from({length: 5}, () => Tenant.actualizarCiclo(tenant._id, ahora)));
    await Tenant.updateOne({ _id: tenant._id }, { $inc: { 'consumoActual.conteosMes': 1 } });
    await Tenant.actualizarCiclo(tenant._id, ahora);
    const t = await Tenant.findById(tenant._id);
    expect(t.estado).toBe('suspendido'); expect(t.consumoActual.periodoActual).toBe('2026-11');
    expect(t.consumoActual.conteosMes).toBe(1); expect(t.consumoActual.almacenamientoUsadoMB).toBe(25);
    expect(require('../utils/periodoCR').periodoCR(new Date('2026-11-01T05:59:59Z'))).toBe('2026-10');
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
    event.data.metadata.planId = 'pro';
    const eventoId = `${event.type}:${event.data.id}`;

    const { req: req1, res: res1 } = buildReqRes(event);
    await webhookOnvo(req1, res1);
    expect(res1.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true })
    );

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('pro');

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
    event.data.metadata.planId = 'pro';

    const { req, res } = buildReqRes(event);
    await webhookOnvo(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true })
    );
    expect(onvoService.cancelarSuscripcion).toHaveBeenCalledWith('clsub_vieja_123');

    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('pro');
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

  test('(g) subscription.renewal.succeeded sin metadata.planId y currentPeriodEnd Unix segundos activa Pro', async () => {
    const tenant = await crearTenantPrueba();
    tenant.onvoCustomerId = 'clcus_live_real_001';
    await tenant.save();

    const unixFuturoSegundos = Math.floor((Date.now() + 30 * 86400000) / 1000);
    const event = {
      type: 'subscription.renewal.succeeded',
      data: {
        id: 'clinv_live_sin_meta_1',
        subscriptionId: 'clsub_live_real_001',
        customerId: 'clcus_live_real_001',
        status: 'active',
        currentPeriodEnd: unixFuturoSegundos,
        // Sin metadata.planId ni metadata.tenantId (caso real ONVO LIVE)
      },
    };

    const { req, res } = buildReqRes(event);
    await webhookOnvo(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('pro');
    expect(t.estado).toBe('activo');
    expect(t.limites.conteosMes).toBe(300);
    expect(t.limites.moduloD150).toBe(true);
    expect(t.limites.anunciosHabilitados).toBe(false);
    expect(t.onvoSubscriptionId).toBe('clsub_live_real_001');
    expect(t.periodoRenovacion.getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  test('(h) payment_intent.succeeded inicial vincula suscripción pendiente allow_incomplete y activa Pro', async () => {
    const tenant = await crearTenantPrueba();
    tenant.onvoCustomerId = 'clcus_live_pi_001';
    tenant.onvoSubscriptionIdPendiente = 'clsub_live_pendiente_001';
    await tenant.save();

    const event = {
      type: 'payment_intent.succeeded',
      data: {
        id: 'clpi_live_001',
        customerId: 'clcus_live_pi_001',
        status: 'succeeded',
      },
    };

    const { req, res } = buildReqRes(event);
    await webhookOnvo(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
    const t = await Tenant.findById(tenant._id);
    expect(t.plan).toBe('pro');
    expect(t.estado).toBe('activo');
    expect(t.onvoSubscriptionId).toBe('clsub_live_pendiente_001');
    expect(t.onvoSubscriptionIdPendiente).toBeNull();
  });

  test('(i) flujo completo API LIVE: checkout (con alias ONVO_PRO_PRICE_ID), auto-conciliación en /estado y recuperación de suspendido', async () => {
    const request = require('supertest');
    const app = require('../server');
    const Usuario = require('../models/Usuario');

    const prevPricePro = process.env.ONVO_PRICE_PRO;
    delete process.env.ONVO_PRICE_PRO;
    process.env.ONVO_PRO_PRICE_ID = 'price_live_alias_pro';

    try {
      const u = await Usuario.create({
        nombre: 'Productor Live',
        email: `live-${Date.now()}@finca.cr`,
        password: 'SyntheticPassword123!',
        rol: 'dueño',
      });
      const t = await Tenant.crearParaUsuario({ nombreFinca: 'Finca Live', owner: u._id, plan: 'free' });
      u.tenantId = t._id;
      await u.save();

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: u.email, password: 'SyntheticPassword123!' });
      const token = login.body.token;

      onvoService.crearCliente.mockResolvedValueOnce({ id: 'cus_live_checkout_1' });
      onvoService.crearSuscripcion.mockResolvedValueOnce({ id: 'sub_live_checkout_1', status: 'incomplete' });

      // 1. Checkout usa alias ONVO_PRO_PRICE_ID y guarda onvoSubscriptionIdPendiente
      const checkoutRes = await request(app)
        .post('/api/onvo/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: 'pro' });

      expect(checkoutRes.status).toBe(200);
      expect(checkoutRes.body).toEqual({
        subscriptionId: 'sub_live_checkout_1',
        customerId: 'cus_live_checkout_1',
        publicKey: process.env.ONVO_PUBLISHABLE_KEY,
      });
      expect(onvoService.crearSuscripcion).toHaveBeenCalledWith(
        expect.objectContaining({ priceId: 'price_live_alias_pro', customerId: 'cus_live_checkout_1' })
      );

      // 2. Auto-conciliación en GET /api/onvo/estado si el SDK ya confirmó y ONVO reporta status='active'
      onvoService.obtenerSuscripcion.mockResolvedValueOnce({
        id: 'sub_live_checkout_1',
        customerId: 'cus_live_checkout_1',
        status: 'active',
        currentPeriodEnd: Math.floor((Date.now() + 30 * 86400000) / 1000),
      });

      const estadoRes = await request(app)
        .get('/api/onvo/estado')
        .set('Authorization', `Bearer ${token}`);

      expect(estadoRes.status).toBe(200);
      expect(estadoRes.body.tenant.plan).toBe('pro');
      expect(estadoRes.body.tenant.estado).toBe('activo');

      // 3. Si la finca cae en 'suspendido', aún puede consultar /estado, hacer /checkout o /cancelar (incluso si ONVO da 404)
      await Tenant.updateOne({ _id: t._id }, { $set: { estado: 'suspendido' } });

      const estadoSuspendido = await request(app)
        .get('/api/onvo/estado')
        .set('Authorization', `Bearer ${token}`);
      expect(estadoSuspendido.status).toBe(200);
      expect(estadoSuspendido.body.tenant.estado).toBe('suspendido');

      const errNotFound = new Error('ONVO: Subscription not found');
      errNotFound.status = 404;
      onvoService.cancelarSuscripcion.mockRejectedValueOnce(errNotFound);

      const cancelarSuspendido = await request(app)
        .post('/api/onvo/cancelar')
        .set('Authorization', `Bearer ${token}`);
      expect(cancelarSuspendido.status).toBe(200);
      expect(cancelarSuspendido.body).toEqual({ ok: true, plan: 'free', estado: 'activo' });
    } finally {
      process.env.ONVO_PRICE_PRO = prevPricePro;
      delete process.env.ONVO_PRO_PRICE_ID;
    }
  });
});
