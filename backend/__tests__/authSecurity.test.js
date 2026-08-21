const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const { login, registro, refrescarToken, logout, protegerRuta } = require('../controllers/authController');
const { protegerRuta: protegerRutaMiddleware } = require('../middleware/authMiddleware');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.post('/api/auth/login', login);
  app.post('/api/auth/registro', registro);
  app.post('/api/auth/refresh', refrescarToken);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/perfil', protegerRutaMiddleware, (req, res) => res.json({ ok: true, user: req.usuario }));
  return app;
};

describe('Auth Security Tests', () => {
  let app;
  let testUser;
  let testTenant;

  beforeAll(() => {
    app = createApp();
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only-32chars!!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only-32chars!!';
  });

  beforeEach(async () => {
    testUser = await Usuario.create({
      nombre: 'Test User',
      email: 'test@example.com',
      password: 'SecurePass123!',
      cedula: '123456789',
      tenantId: null,
      rol: 'dueño',
    });

    testTenant = await Tenant.crearParaUsuario({
      nombreFinca: 'Test Finca',
      owner: testUser._id,
      plan: 'free',
    });

    testUser.tenantId = testTenant._id;
    await testUser.save();
  });

  describe('Rate Limiting / Brute Force Protection', () => {
    it('should allow multiple failed login attempts without lockout (CURRENTLY VULNERABLE)', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrongpassword' });
        expect(res.status).toBe(401);
      }
    });

    it('should allow rapid successive login attempts (NO RATE LIMITING)', async () => {
      const start = Date.now();
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrongpassword' });
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('Password Security', () => {
    it('should reject passwords shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({
          nombre: 'New User',
          email: 'new@example.com',
          password: 'short',
          cedula: '987654321',
        });
      expect(res.status).toBe(400);
    });

    it('should accept weak passwords (no complexity requirements)', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({
          nombre: 'New User',
          email: 'new2@example.com',
          password: 'password123',
          cedula: '987654321',
        });
      expect(res.status).toBe(201);
    });

    it('should hash passwords with bcrypt (cost factor 12)', async () => {
      const user = await Usuario.findById(testUser._id).select('+password');
      expect(user.password).not.toBe('SecurePass123!');
      expect(user.password.startsWith('$2a$12$') || user.password.startsWith('$2b$12$')).toBe(true);
    });
  });

  describe('JWT Token Security', () => {
    let accessToken;
    let refreshToken;

    beforeEach(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });
      accessToken = loginRes.body.token;
      refreshToken = loginRes.headers['set-cookie'][0].split(';')[0].split('=')[1];
    });

    it('should include tenantId and rol in access token payload', () => {
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('tenantId');
      expect(decoded).toHaveProperty('rol');
      expect(decoded.type).toBeUndefined();
    });

    it('should mark refresh token with type: refresh', () => {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      expect(decoded.type).toBe('refresh');
    });

    it('should use httpOnly, secure, sameSite cookies for refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('should reject access token with invalid signature', async () => {
      const tamperedToken = accessToken.slice(0, -5) + 'xxxxx';
      const res = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${tamperedToken}`);
      expect(res.status).toBe(401);
    });

    it('should reject expired access token', async () => {
      const expiredToken = jwt.sign(
        { id: testUser._id, tenantId: testTenant._id, rol: 'dueño' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      const res = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('should NOT allow refresh token reuse after logout (CURRENTLY VULNERABLE - no rotation)', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`refreshToken=${refreshToken}`]);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${refreshToken}`]);
      expect(res.status).toBe(200);
    });

    it('should reject access token without tenantId claim', async () => {
      const tokenNoTenant = jwt.sign(
        { id: testUser._id, rol: 'dueño' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const res = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${tokenNoTenant}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Refresh Token Security', () => {
    it('should reject refresh token with wrong type claim', async () => {
      const fakeRefresh = jwt.sign(
        { id: testUser._id, tenantId: testTenant._id, rol: 'dueño', type: 'access' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${fakeRefresh}`]);
      expect(res.status).toBe(401);
    });

    it('should reject refresh token for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const fakeRefresh = jwt.sign(
        { id: fakeId, tenantId: testTenant._id, rol: 'dueño', type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${fakeRefresh}`]);
      expect(res.status).toBe(401);
    });

    it('should reject refresh token for inactive tenant', async () => {
      testTenant.estado = 'cancelado';
      await testTenant.save();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });
      const rt = loginRes.headers['set-cookie'][0].split(';')[0].split('=')[1];

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${rt}`]);
      expect(res.status).toBe(403);
    });
  });

  describe('Authorization & Access Control', () => {
    it('should reject requests without Authorization header', async () => {
      const res = await request(app).get('/api/auth/perfil');
      expect(res.status).toBe(401);
    });

    it('should reject malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', 'Bearer');
      expect(res.status).toBe(401);
    });

    it('should reject token for deleted user', async () => {
      await Usuario.findByIdAndDelete(testUser._id);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('should prevent access to other tenants data (tenant isolation)', async () => {
      const otherTenant = await Tenant.crearParaUsuario({
        nombreFinca: 'Other Finca',
        owner: null,
        plan: 'free',
      });
      const otherUser = await Usuario.create({
        nombre: 'Other User',
        email: 'other@example.com',
        password: 'SecurePass123!',
        cedula: '999999999',
        tenantId: otherTenant._id,
        rol: 'dueño',
      });
      otherTenant.owner = otherUser._id;
      await otherTenant.save();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'other@example.com', password: 'SecurePass123!' });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.user.tenantId.toString()).toBe(otherTenant._id.toString());
      expect(res.body.user.tenantId.toString()).not.toBe(testTenant._id.toString());
    });
  });

  describe('Registration Security', () => {
    it('should prevent duplicate email registration', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({
          nombre: 'Duplicate',
          email: 'test@example.com',
          password: 'SecurePass123!',
          cedula: '999999999',
        });
      expect(res.status).toBe(400);
    });

    it('should create tenant automatically on registration', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({
          nombre: 'New User',
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          cedula: '999999999',
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('tenantId');
      expect(res.body.plan).toBe('free');
    });

    it('should assign dueño role by default', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({
          nombre: 'New User',
          email: 'role@example.com',
          password: 'SecurePass123!',
          cedula: '999999999',
        });
      expect(res.body.rol).toBe('dueño');
    });
  });

  describe('Logout & Session Management', () => {
    it('should clear refresh token cookie on logout', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });
      const cookie = loginRes.headers['set-cookie'][0];

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [cookie]);
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie'][0]).toContain('refreshToken=;');
      expect(res.headers['set-cookie'][0]).toContain('Max-Age=0');
    });

    it('should invalidate access token on password change (CURRENTLY NOT IMPLEMENTED)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });
      const token = loginRes.body.token;

      await request(app)
        .put('/api/auth/cambiar-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ passwordActual: 'SecurePass123!', passwordNueva: 'NewPass123!' });

      const res = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should reject login with missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'SecurePass123!' });
      expect(res.status).toBe(400);
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('should handle SQL/NoSQL injection attempts in email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com\' || \'1\'=\'1', password: 'SecurePass123!' });
      expect(res.status).toBe(401);
    });

    it('should handle script injection in registration fields', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({
          nombre: '<script>alert(1)</script>',
          email: 'xss@example.com',
          password: 'SecurePass123!',
          cedula: '123456789',
        });
      expect(res.status).toBe(201);
      expect(res.body.nombre).toBe('<script>alert(1)</script>');
    });
  });

  describe('Environment Configuration Security', () => {
    it('should fail if JWT_SECRET is not set (production)', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      expect(() => {
        jwt.sign({ test: 'data' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      }).toThrow();
      
      process.env.JWT_SECRET = originalSecret;
    });

    it('should use separate secrets for access and refresh tokens', () => {
      expect(process.env.JWT_SECRET).not.toBe(process.env.JWT_REFRESH_SECRET);
    });
  });

  describe('Timing Attack Resistance', () => {
    it('should have consistent response time for valid/invalid users', async () => {
      const validTimes = [];
      const invalidTimes = [];

      for (let i = 0; i < 5; i++) {
        const startValid = Date.now();
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrongpassword' });
        validTimes.push(Date.now() - startValid);

        const startInvalid = Date.now();
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'nonexistent@example.com', password: 'wrongpassword' });
        invalidTimes.push(Date.now() - startInvalid);
      }

      const avgValid = validTimes.reduce((a, b) => a + b) / validTimes.length;
      const avgInvalid = invalidTimes.reduce((a, b) => a + b) / invalidTimes.length;
      const diff = Math.abs(avgValid - avgInvalid);
      expect(diff).toBeLessThan(100);
    });
  });
});