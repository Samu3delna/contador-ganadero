const crypto = require('crypto');
const request = require('supertest');
const express = require('express');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const SolicitudEliminacion = require('../models/SolicitudEliminacion');
const whatsappWebhookRoutes = require('../routes/whatsappWebhookRoutes');
const metaDataDeletionRoutes = require('../routes/metaDataDeletionRoutes');
const { parseSignedRequest } = require('../controllers/dataDeletionController');

function base64UrlEncode(bufferOrString) {
  const buf = Buffer.isBuffer(bufferOrString)
    ? bufferOrString
    : Buffer.from(String(bufferOrString), 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createSignedRequest(payloadObj, secret) {
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', secret).update(payload).digest();
  const encodedSig = base64UrlEncode(sig);
  return `${encodedSig}.${payload}`;
}

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
  app.use('/api/webhooks/meta-data-deletion', metaDataDeletionRoutes);
  return app;
};

describe('Meta Data Deletion Callback & Endpoints', () => {
  let app;
  const TEST_APP_SECRET = 'meta_test_app_secret_987654321';

  beforeAll(() => {
    app = createApp();
    process.env.META_APP_SECRET = TEST_APP_SECRET;
    process.env.PUBLIC_SITE_URL = 'https://contadorganandero.com';
  });

  test('parseSignedRequest verifica correctamente la firma HMAC-SHA256 de Meta', () => {
    const payload = {
      algorithm: 'HMAC-SHA256',
      expires: 1291840400,
      issued_at: 1291836800,
      user_id: '218471',
    };
    const signedRequest = createSignedRequest(payload, TEST_APP_SECRET);

    const parsed = parseSignedRequest(signedRequest, TEST_APP_SECRET);
    expect(parsed).not.toBeNull();
    expect(parsed.user_id).toBe('218471');
    expect(parsed.algorithm).toBe('HMAC-SHA256');
  });

  test('parseSignedRequest rechaza una firma adulterada', () => {
    const payload = {
      algorithm: 'HMAC-SHA256',
      issued_at: 1291836800,
      user_id: '218471',
    };
    const badSigned = createSignedRequest(payload, 'otro_secret_incorrecto');
    const parsed = parseSignedRequest(badSigned, TEST_APP_SECRET);
    expect(parsed).toBeNull();
  });

  test('POST /api/webhooks/whatsapp/data-deletion procesa signed_request form-urlencoded, elimina al usuario y devuelve { url, confirmation_code }', async () => {
    const tenant = await Tenant.crearParaUsuario({
      nombreFinca: 'Finca Meta Test',
      owner: null,
      plan: 'free',
    });

    const user = await Usuario.create({
      nombre: 'Productor Meta',
      email: 'metauser@example.com',
      password: 'Password123!',
      telefono: '+50688887777',
      facebookId: '218471',
      tenantId: tenant._id,
      rol: 'dueño',
    });

    tenant.owner = user._id;
    tenant.usuarios = [{ usuarioId: user._id, rol: 'dueño', agregadoEn: new Date() }];
    await tenant.save();

    const signedRequest = createSignedRequest(
      {
        algorithm: 'HMAC-SHA256',
        expires: 1291840400,
        issued_at: 1291836800,
        user_id: '218471',
      },
      TEST_APP_SECRET
    );

    const res = await request(app)
      .post('/api/webhooks/whatsapp/data-deletion')
      .type('form')
      .send({ signed_request: signedRequest });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body).toHaveProperty('confirmation_code');
    expect(res.body.confirmation_code).toMatch(/^[A-Z0-9]+$/);
    expect(res.body.url).toBe(
      `https://contadorganandero.com/eliminacion-datos?id=${res.body.confirmation_code}`
    );

    // Verificar que el usuario fue eliminado de la base de datos
    const userAfter = await Usuario.findById(user._id);
    expect(userAfter).toBeNull();

    // Verificar que la solicitud quedó registrada y puede consultarse por código
    const statusRes = await request(app).get(
      `/api/webhooks/whatsapp/data-deletion/status/${res.body.confirmation_code}`
    );
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.encontrada).toBe(true);
    expect(statusRes.body.estado).toBe('completada');
    expect(statusRes.body.explicacion).toContain(res.body.confirmation_code);
  });

  test('POST /api/webhooks/meta-data-deletion responde 200 con { url, confirmation_code } incluso cuando el user_id no existe en BD', async () => {
    const signedRequest = createSignedRequest(
      {
        algorithm: 'HMAC-SHA256',
        issued_at: 1291836800,
        user_id: '999999999',
      },
      TEST_APP_SECRET
    );

    const res = await request(app)
      .post('/api/webhooks/meta-data-deletion')
      .send({ signed_request: signedRequest });

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://contadorganandero.com/eliminacion-datos?id=');
    expect(res.body.confirmation_code).toMatch(/^[A-Z0-9]+$/);

    const guardada = await SolicitudEliminacion.findOne({
      codigoConfirmacion: res.body.confirmation_code,
    });
    expect(guardada).not.toBeNull();
    expect(guardada.usuarioEncontrado).toBe(false);
  });

  test('POST /api/webhooks/whatsapp/data-deletion/solicitud permite solicitud directa desde formulario público', async () => {
    const res = await request(app)
      .post('/api/webhooks/whatsapp/data-deletion/solicitud')
      .send({
        email: 'productor@finca.cr',
        telefono: '+50688112233',
        confirmacion: true,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('confirmation_code');
    expect(res.body).toHaveProperty('url');
  });
});
