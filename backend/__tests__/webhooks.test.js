const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
jest.mock('../services/whatsappService', () => ({
  enviarMensajeWhatsApp: jest.fn().mockResolvedValue({ mock: true }),
  descargarMediaMeta: jest.fn(),
}));
const whatsappService = require('../services/whatsappService');
const serverApp = require('../server');
const emailWebhookRoutes = require('../routes/emailWebhookRoutes');
const whatsappWebhookRoutes = require('../routes/whatsappWebhookRoutes');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');

const CLAVE_FACTURA_PRUEBA = '5'.repeat(50);
const XML_FACTURA_PRUEBA = `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronica">
  <Clave>${CLAVE_FACTURA_PRUEBA}</Clave><NumeroConsecutivo>00100001010000000001</NumeroConsecutivo>
  <FechaEmision>2026-10-29T10:00:00-06:00</FechaEmision>
  <Emisor><Nombre>Alimentos Agropecuarios CR</Nombre><Identificacion><Tipo>02</Tipo><Numero>3101234567</Numero></Identificacion></Emisor>
  <Receptor><Nombre>Finca Los Suenos</Nombre><Identificacion><Tipo>01</Tipo><Numero>109990888</Numero></Identificacion></Receptor>
  <DetalleServicio><LineaDetalle><NumeroLinea>1</NumeroLinea><Cantidad>1</Cantidad><UnidadMedida>Unid</UnidadMedida><Detalle>Concentrado para ganado</Detalle><PrecioUnitario>10000</PrecioUnitario><SubTotal>10000</SubTotal><BaseImponible>10000</BaseImponible><Impuesto><Codigo>01</Codigo><CodigoTarifa>08</CodigoTarifa><Tarifa>13</Tarifa><Monto>1300</Monto></Impuesto><ImpuestoNeto>1300</ImpuestoNeto><MontoTotalLinea>11300</MontoTotalLinea></LineaDetalle></DetalleServicio>
  <ResumenFactura><TotalMercanciasGravadas>10000</TotalMercanciasGravadas><TotalGravado>10000</TotalGravado><TotalVenta>10000</TotalVenta><TotalVentaNeta>10000</TotalVentaNeta><TotalImpuesto>1300</TotalImpuesto><TotalComprobante>11300</TotalComprobante></ResumenFactura>
</FacturaElectronica>`;

// App de prueba
const createApp = () => {
  const app = express();
  app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
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
    process.env.META_APP_SECRET = 'test_meta_app_secret';
    process.env.GEMINI_API_KEY = '';
    process.env.AI_API_KEY = '';
    process.env.NVIDIA_API_KEY = '';

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

      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex')}`;
      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    });

    it('rechaza un webhook de WhatsApp con firma inválida', async () => {
      const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('X-Hub-Signature-256', 'sha256=invalid')
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Firma/);
    });

    it('rechaza un webhook firmado si no se capturó el cuerpo original', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
      const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const signature = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex')}`;

      const res = await request(testApp)
        .post('/api/webhooks/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(400);
    });

    it('preserva los bytes originales en el servidor Express configurado para producción', async () => {
      const rawBody = JSON.stringify({ object: 'not_whatsapp', entry: [] });
      const signature = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex')}`;
      const res = await request(serverApp)
        .post('/api/webhooks/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    });

    it('descarga y registra un XML de factura enviado como documento', async () => {
      const waTenant = await Tenant.create({ nombreFinca: 'Finca WhatsApp', plan: 'free' });
      await Usuario.create({
        nombre: 'Productor WhatsApp',
        email: 'whatsapp@finca.cr',
        password: 'Password123!',
        cedula: { tipo: 'fisica', numero: '109990888' },
        telefono: '50688889999',
        tenantId: waTenant._id,
        rol: 'owner',
      });
      whatsappService.descargarMediaMeta.mockResolvedValue({ buffer: Buffer.from(XML_FACTURA_PRUEBA) });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { messages: [{
          from: '50688889999',
          id: 'wamid.invoice-1',
          type: 'document',
          document: { id: 'media-test-1', filename: 'factura.xml', mime_type: 'application/xml' },
        }] } }] }],
      };
      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex')}`;
      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      for (let intento = 0; intento < 80 && !whatsappService.descargarMediaMeta.mock.calls.length; intento += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(whatsappService.descargarMediaMeta).toHaveBeenCalledWith('media-test-1');

      let factura;
      for (let intento = 0; intento < 80 && !factura; intento += 1) {
        factura = await Factura.findOne({ claveNumerica: CLAVE_FACTURA_PRUEBA }, null, { skipTenant: true });
        if (!factura) await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(factura).not.toBeNull();
      expect(factura.lineaDetalle).toHaveLength(1);
      expect(factura.carpetaOrigen).toBe('whatsapp');
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

    it('devuelve error visible cuando se recibió XML pero no se pudo procesar', async () => {
      const res = await request(app)
        .post('/api/webhooks/email')
        .set('x-email-webhook-secret', 'test_email_secret_123')
        .send({
          to: 'finca-los-suenos@contadorganandero.com',
          xml: '<NoEsFactura />',
        });

      expect(res.status).toBe(422);
      expect(res.body.recibido).toBe(true);
      expect(res.body.procesadas).toBe(0);
      expect(res.body.detalles[0].exito).toBe(false);
    });

    it('registra una factura XML con sus líneas y evita duplicarla al reenviarla', async () => {
      const emailTenant = await Tenant.create({
        nombreFinca: 'Finca Ingesta Email',
        plan: 'free',
        emailAlias: 'finca-ingesta-email',
      });
      await Usuario.create({
        nombre: 'Productor Email',
        email: 'email@finca.cr',
        password: 'Password123!',
        cedula: { tipo: 'fisica', numero: '109990888' },
        telefono: '50681112222',
        tenantId: emailTenant._id,
        rol: 'owner',
      });

      const enviar = () => request(app)
        .post('/api/webhooks/email')
        .set('x-email-webhook-secret', 'test_email_secret_123')
        .send({ to: 'finca-ingesta-email@contadorganandero.com', xml: XML_FACTURA_PRUEBA });

      const primera = await enviar();
      expect(primera.status).toBe(200);
      expect(primera.body.procesadas).toBe(1);
      expect(primera.body.detalles[0].exito).toBe(true);

      const segunda = await enviar();
      expect(segunda.status).toBe(200);
      expect(segunda.body.detalles[0].duplicada).toBe(true);

      const guardadas = await Factura.countDocuments({ claveNumerica: CLAVE_FACTURA_PRUEBA }, { skipTenant: true });
      const factura = await Factura.findOne({ claveNumerica: CLAVE_FACTURA_PRUEBA }, null, { skipTenant: true });
      expect(guardadas).toBe(1);
      expect(factura.lineaDetalle).toHaveLength(1);
      expect(factura.tenantId.toString()).toBe(emailTenant._id.toString());
    });
  });
});
