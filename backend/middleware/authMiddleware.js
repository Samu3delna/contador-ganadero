const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const { getJwtSecret } = require('../config/env');
const { enterTenantContext } = require('../utils/tenantContext');

const JWT_ISSUER = process.env.JWT_ISSUER || 'contador-ganadero-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'contador-ganadero-web';

/**
 * Middleware para proteger rutas que requieren autenticación.
 * - Exige algoritmo HS256 explícito (bloquea alg=none y confusión de algoritmos).
 * - Rechaza tokens de tipo refresh usados como access token.
 * - Verifica tokenVersion contra la base de datos para revocación inmediata.
 * - Toma rol, tenantId e isSuperAdmin exclusivamente de la base de datos.
 * - Falla cerrado (fail-closed) si MongoDB no está disponible; sin bypass demo.
 * - Establece el contexto de tenant en AsyncLocalStorage para toda la petición.
 */
const protegerRuta = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
    res.status(401);
    return next(new Error('No autorizado — Token no proporcionado'));
  }

  try {
    const partes = req.headers.authorization.split(' ');
    const token = partes.length === 2 ? partes[1] : null;
    if (!token) {
      res.status(401);
      throw new Error('No autorizado — Formato de token inválido');
    }

    const verifyOptions = {
      algorithms: ['HS256'],
    };
    if (process.env.JWT_STRICT_CLAIMS === 'true') {
      verifyOptions.issuer = JWT_ISSUER;
      verifyOptions.audience = JWT_AUDIENCE;
    }

    const decoded = jwt.verify(token, getJwtSecret(), verifyOptions);

    if (!decoded || !decoded.id) {
      res.status(401);
      throw new Error('No autorizado — Token inválido');
    }

    if (decoded.type && decoded.type !== 'access') {
      res.status(401);
      throw new Error('No autorizado — Tipo de token inválido');
    }

    if (decoded.iss && decoded.iss !== JWT_ISSUER) {
      res.status(401);
      throw new Error('No autorizado — Emisor de token inválido');
    }

    if (decoded.aud && decoded.aud !== JWT_AUDIENCE) {
      res.status(401);
      throw new Error('No autorizado — Audiencia de token inválida');
    }

    if (!decoded.tenantId) {
      res.status(401);
      throw new Error('No autorizado — Token sin tenantId');
    }

    // Fail-closed: nunca crear usuarios demo ni permitir acceso sin base de datos activa
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'SERVICIO_NO_DISPONIBLE',
        mensaje: 'Servicio temporalmente no disponible.',
      });
    }

    const usuario = await Usuario.findById(decoded.id).select('-password');
    if (!usuario) {
      res.status(401);
      throw new Error('No autorizado — Usuario no encontrado');
    }

    if (usuario.suspendido) {
      return res.status(403).json({
        error: 'USUARIO_SUSPENDIDO',
        mensaje: 'Tu cuenta está suspendida. Contacta a soporte.',
      });
    }

    // Verificar tokenVersion (revocación inmediata al cambiar contraseña, suspender o cerrar sesiones)
    const versionActual = usuario.tokenVersion || 0;
    const versionToken = decoded.tokenVersion || 0;
    if (versionToken !== versionActual) {
      res.status(401);
      throw new Error('No autorizado — Sesión expirada o revocada');
    }

    // Tomar tenantId, rol e isSuperAdmin exclusivamente de la base de datos
    const tenantIdEfectivo = usuario.tenantId || decoded.tenantId;
    usuario.tenantId = tenantIdEfectivo;
    usuario.rol = usuario.rol || 'dueño';
    usuario.isSuperAdmin = Boolean(usuario.isSuperAdmin);

    req.usuario = usuario;
    req.auth = {
      id: usuario._id,
      tenantId: tenantIdEfectivo,
      rol: usuario.rol,
      tokenVersion: versionActual,
    };

    if (typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'no-store');
    }

    // Establecer contexto en AsyncLocalStorage para aislamiento automático en Mongoose
    enterTenantContext({
      tenantId: tenantIdEfectivo,
      usuarioId: usuario._id,
      rol: usuario.rol,
      isSuperAdmin: usuario.isSuperAdmin,
    });

    return next();
  } catch (err) {
    res.status(401);
    return next(new Error(err.message || 'No autorizado — Token inválido o expirado'));
  }
};

module.exports = { protegerRuta, JWT_ISSUER, JWT_AUDIENCE };
