const request = require('supertest');
const express = require('express');
const { validarEntorno, isOriginAllowed, getTrustProxyHops } = require('../../config/env');
const { createRateLimiter } = require('../../middleware/rateLimiters');
const app = require('../../server');

describe('Bloques 1 y 2: Secretos, Variables de Entorno y Red (CORS / Helmet / Rate Limiting)', () => {
  describe('Validación de Secretos y Variables de Entorno (config/env.js)', () => {
    const baseSecureEnv = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://prod.example.com/contador_ganadero',
      JWT_SECRET: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4',
      JWT_REFRESH_SECRET: 'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6',
      EMAIL_ENC_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      CORS_ORIGINS: 'https://contadorganandero.com,https://app.contadorganandero.com',
      ONVO_WEBHOOK_SECRET: 'onvo_webhook_secret_key_with_more_than_32_characters!!',
      EMAIL_WEBHOOK_SECRET: 'email_webhook_secret_key_with_more_than_32_characters!!',
    };

    it('acepta una configuración de producción completa y robusta', () => {
      const result = validarEntorno({ env: baseSecureEnv, allowTestDefaults: false, exitOnError: false });
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('acepta FRONTEND_URL como origen exacto cuando CORS_ORIGINS no está definido', () => {
      const { CORS_ORIGINS, ...envWithoutCorsOrigins } = baseSecureEnv;
      const result = validarEntorno({
        env: { ...envWithoutCorsOrigins, FRONTEND_URL: 'https://contadorganandero.com' },
        allowTestDefaults: false,
        exitOnError: false,
      });

      expect(result.ok).toBe(true);
      expect(result.CORS_ORIGINS).toEqual(['https://contadorganandero.com']);
    });

    it('rechaza arrancar si falta JWT_SECRET o tiene menos de 32 caracteres', () => {
      const missingJwt = { ...baseSecureEnv, JWT_SECRET: '' };
      expect(() =>
        validarEntorno({ env: missingJwt, allowTestDefaults: false, exitOnError: true })
      ).toThrow(/Configuración de entorno inválida/);

      const shortJwt = { ...baseSecureEnv, JWT_SECRET: 'corto_12345' };
      const res = validarEntorno({ env: shortJwt, allowTestDefaults: false, exitOnError: false });
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
    });

    it('rechaza arrancar si JWT_SECRET y JWT_REFRESH_SECRET son idénticos', () => {
      const sameSecrets = { ...baseSecureEnv, JWT_REFRESH_SECRET: baseSecureEnv.JWT_SECRET };
      const res = validarEntorno({ env: sameSecrets, allowTestDefaults: false, exitOnError: false });
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes('distintos'))).toBe(true);
    });

    it('rechaza EMAIL_ENC_KEY que no tenga exactamente 64 caracteres hexadecimales', () => {
      const weakEncKey = { ...baseSecureEnv, EMAIL_ENC_KEY: 'no_es_hex_de_64_caracteres' };
      const res = validarEntorno({ env: weakEncKey, allowTestDefaults: false, exitOnError: false });
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes('EMAIL_ENC_KEY'))).toBe(true);
    });

    it('rechaza secretos con placeholders de ejemplo (tu_, ejemplo, change_me)', () => {
      const placeholderSecret = {
        ...baseSecureEnv,
        JWT_SECRET: 'tu_jwt_secret_de_ejemplo_con_mas_de_32_caracteres_12345',
      };
      const res = validarEntorno({ env: placeholderSecret, allowTestDefaults: false, exitOnError: false });
      expect(res.ok).toBe(false);
    });

    it('rechaza comodines en CORS_ORIGINS', () => {
      const wildcardCors = { ...baseSecureEnv, CORS_ORIGINS: 'https://*.vercel.app' };
      const res = validarEntorno({ env: wildcardCors, allowTestDefaults: false, exitOnError: false });
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes('CORS_ORIGINS'))).toBe(true);
    });
  });

  describe('CORS Estricto, Helmet y Trust Proxy en Express', () => {
    it('NO devuelve Access-Control-Allow-Origin a dominios ajenos (ej. https://cualquiera.vercel.app o pages.dev)', async () => {
      const resVercel = await request(app)
        .get('/api/health')
        .set('Origin', 'https://cualquiera.vercel.app');
      expect(resVercel.headers['access-control-allow-origin']).toBeUndefined();

      const resPages = await request(app)
        .get('/api/health')
        .set('Origin', 'https://attacker.pages.dev');
      expect(resPages.headers['access-control-allow-origin']).toBeUndefined();

      const resWorkers = await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil.workers.dev');
      expect(resWorkers.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('SÍ devuelve Access-Control-Allow-Origin y Credentials a un origen en la lista exacta', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('responde el preflight de login con el origen de producción y credenciales', async () => {
      const corsAnterior = process.env.CORS_ORIGINS;
      process.env.CORS_ORIGINS = 'https://contadorganandero.com';

      try {
        const res = await request(app)
          .options('/api/auth/login')
          .set('Origin', 'https://contadorganandero.com')
          .set('Access-Control-Request-Method', 'POST')
          .set('Access-Control-Request-Headers', 'content-type');

        expect(res.status).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe('https://contadorganandero.com');
        expect(res.headers['access-control-allow-credentials']).toBe('true');
        expect(res.headers['access-control-allow-methods']).toContain('POST');
      } finally {
        if (corsAnterior === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = corsAnterior;
      }
    });

    it('oculta X-Powered-By e incluye cabeceras de seguridad de Helmet', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('configura trust proxy con valor numérico por defecto 1', () => {
      expect(getTrustProxyHops({})).toBe(1);
      expect(getTrustProxyHops({ TRUST_PROXY_HOPS: '2' })).toBe(2);
    });
  });

  describe('Rate Limiting en Login (429 Too Many Requests)', () => {
    it('responde 429 con standardHeaders cuando se excede el límite de intentos de login', async () => {
      const testApp = express();
      testApp.use(express.json());
      const strictLoginLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: 'Demasiados intentos de inicio de sesión.',
      });
      testApp.post('/api/auth/login', strictLoginLimiter, (req, res) => {
        res.status(401).json({ error: 'Credenciales inválidas' });
      });

      for (let i = 0; i < 3; i++) {
        const r = await request(testApp).post('/api/auth/login').send({ email: 'a@b.com', password: '123' });
        expect(r.status).toBe(401);
      }

      const blocked = await request(testApp).post('/api/auth/login').send({ email: 'a@b.com', password: '123' });
      expect(blocked.status).toBe(429);
      expect(blocked.headers['ratelimit-limit']).toBeDefined();
    });
  });
});
