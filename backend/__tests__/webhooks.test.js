const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const emailWebhookRoutes = require('../routes/emailWebhookRoutes');
const whatsappWebhookRoutes = require('../routes/whatsappWebhookRoutes');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');

// App de prueba
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks/email', emailWebhookRoutes);
  app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
  return app;
};

describe('Webhooks Integration Tests (Cloudflare Email & WhatsApp)', () => {
  let app;
  let testTenant;
  let testUser;

  beforeAll(async () => {
    app = createApp();
    process.env.EMAIL_WEBHOOK_SECRET = 'test_email_secret_123';
    process.env.WHATSAPP_VERIFY_TOKEN = 'test_wa_verify_token';

    testTenant = await Tenant.create({
      nombreFinca: 'Finca Los Sueños',
      plan: 'free',
      emailAlias: 'finca-los-suenos',
    });

    testUser = await Usuario.create({
      nombre: 'Ganadero Samuel',
      email: 'samuel@ejemplo.com',
      password: 'Password123!',
      cedula: { tipo: 'fisica', numero: '109990888' },
      telefono: '50688889999',
      tenantId: testTenant._id,
      rol: 'dueño',
    });
  });

  afterAll(async () => {
    await Usuario.deleteMany({ email: 'samuel@ejemplo.com' });
    await Tenant.deleteMany({ _id: testTenant._id });
    await Factura.deleteMany({ usuario: testUser._id });
  });

  describe('WhatsApp Webhook (Meta Cloud API)', () => {
    it('GET /api/webhooks/whatsapp debe validar handshake de Meta con token correcto', async () => {
      const res = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_wa_verify_token',
          'hub.challenge': 'challenge_code_98765',
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe('challenge_code_98765');
    });

    it('GET /api/webhooks/whatsapp debe rechazar token inválido con 403', async () => {
      const res = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'token_falso',
          'hub.challenge': 'challenge_code_98765',
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/webhooks/whatsapp debe responder 200 EVENT_RECEIVED a mensajes válidos', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '50688889999',
                      id: 'wamid.12345',
                      timestamp: '1710000000',
                      type: 'text',
                      text: { body: 'Hola, quiero registrar un gasto' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    });
  });

  describe('Cloudflare Email Webhook', () => {
    it('POST /api/webhooks/email debe rechazar si el secreto es inválido', async () => {
      const res = await request(app)
        .post('/api/webhooks/email')
        .set('x-email-webhook-secret', 'secreto_incorrecto')
        .send({ to: 'finca-los-suenos@contadorganandero.com' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('No autorizado');
    });

    it('POST /api/webhooks/email debe aceptar email y reportar 0 procesadas si no hay XML', async () => {
      const res = await request(app)
        .post('/api/webhooks/email')
        .set('x-email-webhook-secret', 'test_email_secret_123')
        .send({
          to: 'finca-los-suenos@contadorganandero.com',
          from: 'proveedor@veterinaria.cr',
          rawEmail: 'Subject: Recordatorio de pago\n\nEstimado cliente, favor pagar.',
        });

      expect(res.status).toBe(200);
      expect(res.body.recibido).toBe(true);
      expect(res.body.procesadas).toBe(0);
    });
  });
});
