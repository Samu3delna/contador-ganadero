jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn().mockImplementation(() => ({
  getToken: async () => ({ tokens: { id_token: 'synthetic-token' } }),
  setCredentials: () => {},
  verifyIdToken: async () => ({ getPayload: () => ({ email_verified: true, email: 'mfa@example.test', sub: 'google-synthetic' }) }),
})) }));
const request = require('supertest');
const app = require('../server');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const { generateTotpCode, generateBackupCodes } = require('../utils/totp');
const { crearDesafio } = require('../services/mfaService');
const secret = 'JBSWY3DPEHPK3PXP';
let user;
beforeEach(async () => {
  user = await Usuario.create({ nombre: 'MFA', email: 'mfa@example.test', cedula: {tipo:'fisica',numero:'123456789'}, nombreFinca: 'Finca MFA', password: 'SyntheticPassword123!', rol: 'owner', googleId: 'google-synthetic' });
  const tenant = await Tenant.crearParaUsuario({ nombreFinca: 'Finca MFA', owner: user._id });
  user.tenantId = tenant._id; user.setMfaSecret(secret); user.mfa.enabled = true; await user.save();
});
const login = () => request(app).post('/api/auth/login').send({ email: user.email, password: 'SyntheticPassword123!' });
test('F-02/F-22: desafio comun no emite sesion hasta TOTP y no admite replay', async () => {
  const pending = await login(); expect(pending.body.mfaRequired).toBe(true);
  expect(pending.headers['set-cookie']).toBeUndefined(); expect(pending.body.token).toBeUndefined();
  const body = { mfaToken: pending.body.mfaToken, totpCode: generateTotpCode(secret) };
  const done = await request(app).post('/api/auth/mfa/verify').send(body);
  expect(done.status).toBe(200); expect(done.body.token).toBeTruthy();
  expect(done.body.cedula.numero).toBe('123456789'); expect(done.body.nombreFinca).toBe('Finca MFA');
  expect(done.body.tenant.configuracionHacienda?.certificadoP12Base64).toBeUndefined();
  expect(done.headers['set-cookie'].some(c => c.startsWith('refreshToken='))).toBe(true);
  expect((await request(app).post('/api/auth/mfa/verify').send(body)).status).toBe(401);
});
test('F-22: Google con MFA solo entrega cookie de desafio y redirige al formulario MFA', async () => {
  const response = await request(app).get('/api/auth/google/callback?code=synthetic');
  expect(response.status).toBe(302); expect(response.headers.location).toContain('/login?mfa=1');
  expect(response.headers['set-cookie'].some(c => c.startsWith('mfaChallenge='))).toBe(true);
  expect(response.headers['set-cookie'].some(c => c.startsWith('refreshToken=') && !c.startsWith('refreshToken=;'))).toBe(false);
  const cookie = response.headers['set-cookie'].find(c => c.startsWith('mfaChallenge=')).split(';')[0];
  const done = await request(app).post('/api/auth/mfa/verify').set('Cookie', cookie).send({ totpCode: generateTotpCode(secret) });
  expect(done.status).toBe(200);
});
test('codigos de respaldo se consumen atomicamente incluso con dos desafios validos', async () => {
  const codes = generateBackupCodes(); user.mfa.backupCodesHash = codes.hashedCodes; await user.save();
  const tokens = await Promise.all([crearDesafio(user), crearDesafio(user)]);
  const responses = await Promise.all(tokens.map(mfaToken => request(app).post('/api/auth/mfa/verify').send({ mfaToken, backupCode: codes.plainCodes[0] })));
  expect(responses.map(r => r.status).sort()).toEqual([200, 401]);
});
test('F-21: reemplazo exige reautenticacion y conserva secreto activo hasta confirmar pendiente', async () => {
  const auth = require('../controllers/authController').generarToken(user, user.tenantId, Date.now());
  const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${auth}`)
    .send({ password: 'SyntheticPassword123!', totpCode: generateTotpCode(secret) });
  expect(setup.status).toBe(200);
  let current = await Usuario.findById(user._id).select('+mfa.secretEncrypted');
  expect(current.getMfaSecret()).toBe(secret); expect(current.mfa.enabled).toBe(true);
  const enable = await request(app).post('/api/auth/mfa/enable').set('Authorization', `Bearer ${auth}`)
    .send({ totpCode: generateTotpCode(setup.body.secret) });
  expect(enable.status).toBe(200);
  current = await Usuario.findById(user._id).select('+mfa.secretEncrypted');
  expect(current.getMfaSecret()).toBe(setup.body.secret);
  const disable = await request(app).post('/api/auth/mfa/disable').set('Authorization', `Bearer ${auth}`).send({ password: 'SyntheticPassword123!' });
  expect(disable.status).toBe(401); expect((await Usuario.findById(user._id)).mfa.enabled).toBe(true);
});
test('F-42: dos refresh del mismo token no crean dos sesiones validas', async () => {
  const { emitirRefreshToken } = require('../controllers/authController');
  const refresh = await emitirRefreshToken(user, user.tenantId, {}, null, Date.now());
  const responses = await Promise.all(Array.from({ length: 2 }, () => request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${refresh.token}`)));
  expect(responses.filter(r => r.status === 200)).toHaveLength(1);
  expect(responses.filter(r => r.status === 401)).toHaveLength(1);
  const issued = responses.find(r => r.status === 200);
  expect((await request(app).get('/api/auth/perfil').set('Authorization', `Bearer ${issued.body.token}`)).status).toBe(401);
});
