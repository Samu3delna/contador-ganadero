const request = require('supertest');
const app = require('../server');

test('los endpoints retirados responden 404', async () => {
  const routes = [
    ['get', '/api/webhooks/whatsapp'],
    ['post', '/api/webhooks/whatsapp'],
    ['post', '/api/webhooks/meta-data-deletion'],
    ['post', '/api/hacienda/fec'],
    ['post', '/api/hacienda/rep'],
    ['get', '/api/hacienda/d150/conciliacion'],
    ['get', '/api/hacienda/d150/reporte/pdf'],
    ['get', '/api/hacienda/d150/reporte/excel'],
    ['post', '/api/facturacion'],
  ];
  for (const [method, url] of routes) {
    const response = await request(app)[method](url).send({});
    expect(response.status).toBe(404);
  }
});

test('el webhook de correo sigue autenticando solicitudes', async () => {
  const previo = process.env.EMAIL_WEBHOOK_SECRET;
  process.env.EMAIL_WEBHOOK_SECRET = 'test_email_secret_123';
  const response = await request(app).post('/api/webhooks/email')
    .set('x-email-webhook-secret', 'secreto_incorrecto')
    .send({ to: 'finca@contadorganandero.com' });
  if (previo === undefined) delete process.env.EMAIL_WEBHOOK_SECRET;
  else process.env.EMAIL_WEBHOOK_SECRET = previo;
  expect(response.status).toBe(401);
});
