const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const { encrypt } = require('../utils/crypto');
const { emitirRefreshToken, setRefreshCookie } = require('./authController');
const { getAllowedOrigins } = require('../config/env');
const { audit } = require('../utils/audit');

// Scopes mínimos para login con Google (sin https://mail.google.com/)
const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getOAuth2Client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );
}

function getSafeFrontendUrl() {
  const configured = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
  const allowed = getAllowedOrigins();
  if (allowed.length > 0 && !allowed.includes(configured)) {
    return allowed[0];
  }
  return configured;
}

const googleLogin = (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth/google',
  });

  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: SCOPES,
    prompt: 'select_account',
    state,
  });

  res.redirect(url);
};

const googleCallback = async (req, res, next) => {
  const frontendUrl = getSafeFrontendUrl();
  try {
    const { code, state } = req.query;
    const cookieState = req.cookies?.oauth_state;

    res.clearCookie('oauth_state', { path: '/api/auth/google' });

    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    // Validar parámetro state contra CSRF cuando la cookie oauth_state está presente o en producción
    if (cookieState || process.env.NODE_ENV === 'production') {
      if (
        !state ||
        !cookieState ||
        typeof state !== 'string' ||
        state.length !== cookieState.length ||
        !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(cookieState))
      ) {
        return res.redirect(`${frontendUrl}/login?error=invalid_oauth_state`);
      }
    }

    const client = getOAuth2Client();
    const { tokens } = await client.getToken(String(code));
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || payload.email_verified !== true || !payload.email || !payload.sub) {
      return res.redirect(`${frontendUrl}/login?error=google_email_unverified`);
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const nombre = payload.name || email.split('@')[0];

    // Buscar primero únicamente por googleId para evitar apropiación de cuentas existentes con contraseña
    let usuario = await Usuario.findOne({ googleId });

    if (!usuario) {
      const cuentaExistentePorEmail = await Usuario.findOne({ email });
      if (cuentaExistentePorEmail) {
        return res.redirect(`${frontendUrl}/login?error=account_exists_use_password`);
      }

      const tenant = await Tenant.crearParaUsuario({
        nombreFinca: 'Mi Finca',
        owner: null,
        plan: 'free',
      });

      const randomPassHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      usuario = await Usuario.create({
        googleId,
        nombre,
        email,
        emailVerificado: true,
        tenantId: tenant._id,
        rol: 'dueño',
        isSuperAdmin: false,
        aceptoTerminosEn: new Date(),
        password: randomPassHash,
      });

      tenant.owner = usuario._id;
      tenant.usuarios = [{ usuarioId: usuario._id, rol: 'dueño', agregadoEn: new Date() }];
      await tenant.save();
    }

    if (usuario.suspendido) {
      return res.redirect(`${frontendUrl}/login?error=account_suspended`);
    }

    const aadScope = String(usuario.tenantId || usuario._id || 'global');
    if (tokens.access_token) {
      usuario.googleAccessToken = encrypt(tokens.access_token, { tenantId: aadScope, field: 'usuario.googleAccessToken' });
    }
    if (tokens.refresh_token) {
      usuario.googleRefreshToken = encrypt(tokens.refresh_token, { tenantId: aadScope, field: 'usuario.googleRefreshToken' });
    }

    await usuario.save();

    const tenant = await Tenant.findById(usuario.tenantId);
    const { token: refreshToken } = await emitirRefreshToken(usuario, tenant._id, req);
    setRefreshCookie(res, refreshToken);

    await audit(req, {
      accion: 'auth.google_login',
      usuarioId: usuario._id,
      tenantId: tenant._id,
      resultado: 'success',
    });

    // Redirigir SIN exponer el JWT en la query string (?token=...). El frontend renueva con /api/auth/refresh
    const destino = usuario.isSuperAdmin === true ? '/admin' : '/dashboard';
    return res.redirect(`${frontendUrl}${destino}`);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  googleLogin,
  googleCallback,
};
