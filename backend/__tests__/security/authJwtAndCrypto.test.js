const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const Usuario = require('../../models/Usuario');
const Tenant = require('../../models/Tenant');
const { encryptSecret, decryptSecret, reencryptSecret, needsReencryption } = require('../../utils/crypto');
const { generateTotpSecret, generateTotpCode } = require('../../utils/totp');
const { cifrarBufferGcm, descifrarBufferGcm } = require('../../scripts/backup-mongodb');

describe('Bloques 5, 6, 7 y 13: JWT Estricto, Rotación Refresh, MFA TOTP, AES-256-GCM y Respaldos Cifrados', () => {
  let user;
  let tenant;

  beforeEach(async () => {
    user = await Usuario.create({
      nombre: 'Crypto User',
      email: 'crypto@finca.cr',
      password: 'CryptoPassword123!',
      cedula: '102220333',
      rol: 'owner',
    });
    tenant = await Tenant.crearParaUsuario({
      nombreFinca: 'Finca Crypto',
      owner: user._id,
      plan: 'pro',
    });
    user.tenantId = tenant._id;
    await user.save();
  });

  describe('JWT Hardening y Detección de Reuso de Refresh Token', () => {
    it('rechaza tokens con algoritmo none o firmados como refresh en rutas de API', async () => {
      const algNoneToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(
        JSON.stringify({ id: user._id, tenantId: tenant._id, rol: 'owner' })
      ).toString('base64url')}.`;

      const resNone = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${algNoneToken}`);
      expect(resNone.status).toBe(401);

      // Token de tipo refresh usado como Bearer access token
      const refreshAsAccess = jwt.sign(
        { id: user._id, tenantId: tenant._id, rol: 'owner', type: 'refresh' },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' }
      );
      const resRefreshType = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${refreshAsAccess}`);
      expect(resRefreshType.status).toBe(401);
    });

    it('rota el refresh token en cada uso y revoca toda la familia si se detecta reuso del token anterior', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'crypto@finca.cr', password: 'CryptoPassword123!' });
      const rt1Cookie = loginRes.headers['set-cookie'][0].split(';')[0];

      // 1. Primer refresh legítimo -> entrega rt2
      const refresh1 = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [rt1Cookie]);
      expect(refresh1.status).toBe(200);
      const rt2Cookie = refresh1.headers['set-cookie'][0].split(';')[0];
      expect(rt2Cookie).not.toBe(rt1Cookie);

      // 2. Atacante intenta reusar rt1 (ya rotado) -> 401 y revoca toda la familia
      const reuseAttempt = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [rt1Cookie]);
      expect(reuseAttempt.status).toBe(401);

      // 3. El token rt2 también queda invalidado tras la detección de robo de familia
      const rt2AfterCompromise = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [rt2Cookie]);
      expect(rt2AfterCompromise.status).toBe(401);
    });
  });

  describe('MFA TOTP (RFC 6238)', () => {
    it('permite configurar y activar MFA TOTP, exigiendo código en el login siguiente', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'crypto@finca.cr', password: 'CryptoPassword123!' });
      const token = loginRes.body.token;

      // Setup MFA
      const setupRes = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${token}`);
      expect(setupRes.status).toBe(200);
      const secret = setupRes.body.secret;
      expect(secret).toBeDefined();

      // Enable MFA con código TOTP válido
      const validCode = generateTotpCode(secret);
      const enableRes = await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${token}`)
        .send({ totpCode: validCode });
      expect(enableRes.status).toBe(200);
      expect(enableRes.body.recoveryCodes).toHaveLength(8);

      // Login sin totpCode -> indica mfaRequired: true sin entregar JWT
      const loginNoMfa = await request(app)
        .post('/api/auth/login')
        .send({ email: 'crypto@finca.cr', password: 'CryptoPassword123!' });
      expect(loginNoMfa.status).toBe(200);
      expect(loginNoMfa.body.mfaRequired).toBe(true);
      expect(loginNoMfa.body.token).toBeUndefined();

      // Login con totpCode válido -> entrega JWT
      const loginWithMfa = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'crypto@finca.cr',
          password: 'CryptoPassword123!',
          totpCode: generateTotpCode(secret),
        });
      expect(loginWithMfa.status).toBe(200);
      expect(loginWithMfa.body.token).toBeDefined();
    });
  });

  describe('Cifrado Autenticado AES-256-GCM con HKDF por Tenant y AAD', () => {
    it('cifra en formato v2:kid:iv:tag:cipher y falla si se altera 1 byte del ciphertext o se cambia el tenantId', () => {
      const ctxA = { tenantId: tenant._id.toString(), fieldName: 'haciendaConfig.pinP12Enc' };
      const encrypted = encryptSecret('1234', ctxA);
      expect(encrypted.startsWith('v2:')).toBe(true);
      expect(needsReencryption(encrypted)).toBe(false);

      // Descifrado legítimo
      expect(decryptSecret(encrypted, ctxA)).toBe('1234');

      // Descifrado con otro tenantId (AAD mismatch + subllave HKDF distinta) -> lanza error
      expect(() =>
        decryptSecret(encrypted, { tenantId: 'otro_tenant_id', fieldName: 'haciendaConfig.pinP12Enc' })
      ).toThrow();

      // Alterar 1 byte del ciphertext -> lanza error de integridad GCM
      const parts = encrypted.split(':');
      const tamperedCipher = parts[4].slice(0, -2) + (parts[4].endsWith('aa') ? 'bb' : 'aa');
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedCipher}`;
      expect(() => decryptSecret(tampered, ctxA)).toThrow();
    });
  });

  describe('Respaldos Cifrados AES-256-GCM (scripts/backup-mongodb.js)', () => {
    it('cifra y descifra buffers verificando el AuthTag GCM', () => {
      const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const original = Buffer.from(JSON.stringify({ test: 'respaldo_seguro' }), 'utf8');
      const cifrado = cifrarBufferGcm(original, hexKey);
      const descifrado = descifrarBufferGcm(cifrado, hexKey);
      expect(descifrado.toString('utf8')).toBe(original.toString('utf8'));

      // Alterar 1 byte invalida el respaldo
      cifrado[cifrado.length - 1] ^= 0xff;
      expect(() => descifrarBufferGcm(cifrado, hexKey)).toThrow();
    });
  });
});
