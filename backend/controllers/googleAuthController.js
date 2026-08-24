const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const { encrypt } = require('../utils/crypto');

const generarToken = (usuario, tenantId) => {
  return jwt.sign(
    { id: usuario._id, tenantId, rol: usuario.rol || 'dueño' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '1h' }
  );
};

const generarRefreshToken = (usuario, tenantId) => {
  return jwt.sign(
    { id: usuario._id, tenantId, rol: usuario.rol || 'dueño', type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

const setRefreshCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
};

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://mail.google.com/',
];

const getGoogleAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
};

const googleLogin = (req, res) => {
  const url = getGoogleAuthUrl();
  res.redirect(url);
};

const googleCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const nombre = payload.name;
    const picture = payload.picture;

    let usuario = await Usuario.findOne({ $or: [{ googleId }, { email }] });

    if (!usuario) {
      const tenant = await Tenant.crearParaUsuario({
        nombreFinca: 'Mi Finca',
        owner: null,
        plan: 'free',
      });

      usuario = await Usuario.create({
        googleId,
        nombre,
        email,
        tenantId: tenant._id,
        rol: 'dueño',
        password: await require('bcryptjs').hash(require('crypto').randomBytes(32).toString('hex'), 12),
      });

      tenant.owner = usuario._id;
      tenant.usuarios = [{ usuarioId: usuario._id, rol: 'dueño', agregadoEn: new Date() }];
      await tenant.save();
    } else if (!usuario.googleId) {
      usuario.googleId = googleId;
    }

    if (tokens.access_token) {
      usuario.googleAccessToken = encrypt(tokens.access_token);
    }
    if (tokens.refresh_token) {
      usuario.googleRefreshToken = encrypt(tokens.refresh_token);
    }

    await usuario.save();

    const tenant = await Tenant.findById(usuario.tenantId);
    const accessToken = generarToken(usuario, tenant._id);
    const refreshToken = generarRefreshToken(usuario, tenant._id);
    setRefreshCookie(res, refreshToken);

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${accessToken}`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  googleLogin,
  googleCallback,
};