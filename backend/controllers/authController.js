const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
let QRCode = null;
try { QRCode = require('qrcode'); } catch { /* opcional */ }
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const RefreshToken = require('../models/RefreshToken');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const Inventario = require('../models/Inventario');
const CostoProduccion = require('../models/CostoProduccion');
const Declaracion = require('../models/Declaracion');
const { getJwtSecret, getJwtRefreshSecret } = require('../config/env');
const { JWT_ISSUER, JWT_AUDIENCE } = require('../middleware/authMiddleware');
const { validarPoliticaPassword, verificarPasswordFiltradoHIBP } = require('../utils/pwnedPassword');
const { generateTotpSecret, buildOtpAuthUrl, verifyTotpToken, generateBackupCodes, verifyBackupCode } = require('../utils/totp');
const { audit } = require('../utils/audit');

const DUMMY_HASH = '$2a$12$e8Ov5y2ZJ7m6V3QvX7fX9.kX6f8oFzN0zJz5t1Z5V3m6V3QvX7fX9';

/**
 * Genera access token JWT con claims { id, tenantId, rol, tokenVersion } y algoritmo HS256 explícito.
 */
const generarToken = (usuario, tenantId) => {
  return jwt.sign(
    {
      id: usuario._id,
      tenantId,
      rol: usuario.rol || 'dueño',
      tokenVersion: usuario.tokenVersion || 0,
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRE || '15m',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
};

/**
 * Genera y persiste un refresh token con rotación y detección de reúso por familia.
 */
const emitirRefreshToken = async (usuario, tenantId, req, familyId = null) => {
  const jti = crypto.randomUUID();
  const jtiHash = RefreshToken.hashTokenId(jti);
  const familia = familyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const token = jwt.sign(
    {
      id: usuario._id,
      tenantId,
      rol: usuario.rol || 'dueño',
      type: 'refresh',
      jti,
      familyId: familia,
      tokenVersion: usuario.tokenVersion || 0,
    },
    getJwtRefreshSecret(),
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );

  if (mongoose.connection.readyState === 1) {
    await RefreshToken.create({
      jtiHash,
      familyId: familia,
      usuarioId: usuario._id,
      tenantId,
      expiresAt,
      ip: req?.ip || req?.connection?.remoteAddress || '',
      userAgent: String(req?.headers?.['user-agent'] || '').slice(0, 256),
    });
  }

  return { token, jti, jtiHash, familyId: familia };
};

/**
 * Setea cookie httpOnly con el refresh token
 */
const setRefreshCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
};

const clearRefreshCookie = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 0,
  });
};

/**
 * @desc    Registrar nuevo usuario (crea implícitamente un Tenant)
 * @route   POST /api/auth/registro
 * @access  Público
 */
const registro = async (req, res, next) => {
  try {
    const {
      nombre,
      email,
      password,
      cedula,
      nombreFinca,
      cantidadHijos,
      tieneConyuge,
      telefono,
      aceptaTerminos,
      versionTerminos,
    } = req.body;

    if (aceptaTerminos !== true) {
      res.status(400);
      throw new Error('Debes aceptar los Términos y Condiciones para crear tu cuenta');
    }

    if (!nombre || !email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400);
      throw new Error('Nombre, email y contraseña son obligatorios');
    }

    const validacionPass = validarPoliticaPassword(password);
    if (!validacionPass.valido) {
      res.status(400);
      throw new Error(validacionPass.errores[0]);
    }

    if (process.env.HIBP_CHECK_ENABLED === 'true') {
      const pwned = await verificarPasswordFiltradoHIBP(password);
      if (pwned.comprometida) {
        res.status(400);
        throw new Error('Esta contraseña aparece en filtraciones públicas conocidas. Elige una contraseña distinta.');
      }
    }

    const emailNormalizado = String(email).toLowerCase().trim();
    const existe = await Usuario.findOne({ email: emailNormalizado });
    if (existe) {
      res.status(400);
      throw new Error('No fue posible completar el registro con los datos proporcionados');
    }

    const tenant = await Tenant.crearParaUsuario({
      nombreFinca: nombreFinca ? String(nombreFinca).trim().slice(0, 120) : 'Mi Finca',
      owner: null,
      plan: 'free',
    });

    let telefonoNormalizado = telefono ? String(telefono).trim() : undefined;
    if (telefonoNormalizado) {
      const digits = telefonoNormalizado.replace(/\D/g, '');
      if (digits.length === 8) {
        telefonoNormalizado = `+506${digits}`;
      } else if (digits.startsWith('506') && digits.length === 11) {
        telefonoNormalizado = `+${digits}`;
      } else if (!telefonoNormalizado.startsWith('+')) {
        telefonoNormalizado = `+506${digits}`;
      }
    }

    const tokenVerificacionRaw = crypto.randomBytes(32).toString('hex');
    const tokenVerificacionHash = crypto.createHash('sha256').update(tokenVerificacionRaw).digest('hex');
    const ahora = new Date();

    // Asignación explícita de campos — bloquea inyección de rol, isSuperAdmin, tenantId o plan
    const usuario = await Usuario.create({
      nombre: String(nombre).trim().slice(0, 100),
      email: emailNormalizado,
      password,
      cedula,
      nombreFinca: nombreFinca ? String(nombreFinca).trim().slice(0, 120) : 'Mi Finca',
      telefono: telefonoNormalizado,
      cantidadHijos: Number.isFinite(Number(cantidadHijos)) ? Math.max(0, Math.min(20, Number(cantidadHijos))) : 0,
      tieneConyuge: Boolean(tieneConyuge),
      aceptoTerminosEn: ahora,
      consentimientoLegal: {
        versionTerminos: String(versionTerminos || 'v1.0-2026').slice(0, 32),
        versionPrivacidad: 'v1.0-2026',
        fechaAceptacion: ahora,
        ipAceptacion: req.ip || '',
        userAgentAceptacion: String(req.headers['user-agent'] || '').slice(0, 256),
      },
      emailVerificado: false,
      emailVerificationTokenHash: tokenVerificacionHash,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      tenantId: tenant._id,
      rol: 'dueño',
      isSuperAdmin: false,
    });

    tenant.owner = usuario._id;
    tenant.usuarios = [{ usuarioId: usuario._id, rol: 'dueño', agregadoEn: ahora }];
    await tenant.save();

    const accessToken = generarToken(usuario, tenant._id);
    const { token: refreshToken } = await emitirRefreshToken(usuario, tenant._id, req);
    setRefreshCookie(res, refreshToken);

    await audit(req, {
      accion: 'auth.register',
      usuarioId: usuario._id,
      tenantId: tenant._id,
      recurso: 'Usuario',
      recursoId: usuario._id,
      resultado: 'success',
    });

    res.status(201).json({
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      telefono: usuario.telefono,
      cedula: usuario.cedula,
      nombreFinca: usuario.nombreFinca,
      tenantId: tenant._id,
      plan: tenant.plan,
      rol: usuario.rol,
      esSuperAdmin: false,
      tenant: {
        _id: tenant._id,
        nombreFinca: tenant.nombreFinca,
        plan: tenant.plan,
        estado: tenant.estado,
        emailAlias: tenant.emailAlias,
      },
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Iniciar sesión
 * @route   POST /api/auth/login
 * @access  Público
 */
const login = async (req, res, next) => {
  try {
    const { email, password, totpCode, backupCode } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400);
      throw new Error('Email y contraseña son obligatorios');
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'SERVICIO_NO_DISPONIBLE',
        mensaje: 'Servicio temporalmente no disponible.',
      });
    }

    const emailLimpio = email.toLowerCase().trim();
    const usuario = await Usuario.findOne({ email: emailLimpio })
      .select('+password +mfa.secretEncrypted +mfa.backupCodesHash');

    // Si la cuenta está bloqueada temporalmente, ejecutar bcrypt contra DUMMY_HASH para mantener tiempo constante
    if (usuario && usuario.estaBloqueado()) {
      await bcrypt.compare(password, DUMMY_HASH);
      await audit(req, {
        accion: 'auth.login_locked',
        usuarioId: usuario._id,
        tenantId: usuario.tenantId,
        resultado: 'denied',
      });
      res.status(423);
      throw new Error('Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en 15 minutos.');
    }

    let passwordValido = false;
    if (usuario) {
      passwordValido = await usuario.compararPassword(password);
    } else {
      await bcrypt.compare(password, DUMMY_HASH);
    }

    if (!usuario || !passwordValido) {
      if (usuario) {
        await usuario.registrarIntentoFallido();
      }
      await audit(req, {
        accion: 'auth.login_failed',
        usuarioId: usuario?._id || null,
        tenantId: usuario?.tenantId || null,
        resultado: 'failure',
        metadata: { emailHash: crypto.createHash('sha256').update(emailLimpio).digest('hex').slice(0, 16) },
      });
      res.status(401);
      throw new Error('Credenciales incorrectas');
    }

    if (usuario.loginAttempts > 0 || usuario.lockUntil) {
      await usuario.resetearIntentosLogin();
    }

    if (usuario.suspendido) {
      res.status(403);
      throw new Error('Tu cuenta está suspendida. Contacta a soporte.');
    }

    if (!usuario.tenantId) {
      res.status(403);
      throw new Error('Usuario sin tenant asociado. Contacta soporte.');
    }

    const tenant = await Tenant.findById(usuario.tenantId);
    if (!tenant) {
      res.status(403);
      throw new Error('Tenant asociado no encontrado. Contacta soporte.');
    }

    // Verificación MFA TOTP si está habilitada para el usuario
    if (usuario.mfa?.enabled) {
      if (!totpCode && !backupCode) {
        const mfaChallengeToken = jwt.sign(
          { id: usuario._id, tenantId: tenant._id, type: 'mfa_challenge' },
          getJwtSecret(),
          { algorithm: 'HS256', expiresIn: '5m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
        );
        return res.status(200).json({
          mfaRequired: true,
          mfaToken: mfaChallengeToken,
          mensaje: 'Ingresa el código de tu aplicación autenticadora (2FA).',
        });
      }

      let mfaOk = false;
      if (totpCode) {
        const secretBase32 = usuario.getMfaSecret();
        mfaOk = Boolean(secretBase32 && verifyTotpToken(secretBase32, totpCode));
      } else if (backupCode) {
        const check = verifyBackupCode(backupCode, usuario.mfa.backupCodesHash || []);
        if (check.valid) {
          mfaOk = true;
          usuario.mfa.backupCodesHash = check.remainingHashes;
          await usuario.save();
        }
      }

      if (!mfaOk) {
        await usuario.registrarIntentoFallido();
        await audit(req, {
          accion: 'auth.mfa_failed',
          usuarioId: usuario._id,
          tenantId: tenant._id,
          resultado: 'failure',
        });
        res.status(401);
        throw new Error('Código de verificación 2FA inválido');
      }
    }

    if (!tenant.emailAlias) {
      const slug = (tenant.nombreFinca || 'finca').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20);
      tenant.emailAlias = `${slug}-${usuario._id.toString().slice(-4)}`;
      await Tenant.updateOne({ _id: tenant._id }, { emailAlias: tenant.emailAlias });
    }

    const accessToken = generarToken(usuario, tenant._id);
    const { token: refreshToken } = await emitirRefreshToken(usuario, tenant._id, req);
    setRefreshCookie(res, refreshToken);

    await audit(req, {
      accion: 'auth.login_success',
      usuarioId: usuario._id,
      tenantId: tenant._id,
      resultado: 'success',
    });

    res.json({
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      telefono: usuario.telefono,
      cedula: usuario.cedula,
      nombreFinca: usuario.nombreFinca,
      tenantId: tenant._id,
      plan: tenant.plan,
      estadoTenant: tenant.estado,
      rol: usuario.rol,
      esSuperAdmin: usuario.isSuperAdmin === true,
      mfaEnabled: Boolean(usuario.mfa?.enabled),
      tenant: {
        _id: tenant._id,
        nombreFinca: tenant.nombreFinca,
        plan: tenant.plan,
        estado: tenant.estado,
        emailAlias: tenant.emailAlias,
      },
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Renovar access token usando refresh token de la cookie (con rotación y detección de reúso)
 * @route   POST /api/auth/refresh
 * @access  Público (usa cookie httpOnly)
 */
const refrescarToken = async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.refreshToken;
    if (!cookieToken) {
      res.status(401);
      throw new Error('No refresh token provided');
    }

    let decoded;
    try {
      decoded = jwt.verify(cookieToken, getJwtRefreshSecret(), { algorithms: ['HS256'] });
    } catch {
      res.status(401);
      throw new Error('Refresh token inválido o expirado');
    }

    if (!decoded || decoded.type !== 'refresh') {
      res.status(401);
      throw new Error('Token inválido');
    }

    const usuario = await Usuario.findById(decoded.id).select('-password');
    if (!usuario) {
      res.status(401);
      throw new Error('Usuario no encontrado');
    }

    if (usuario.suspendido) {
      res.status(403);
      throw new Error('Usuario suspendido');
    }

    if ((decoded.tokenVersion || 0) !== (usuario.tokenVersion || 0)) {
      clearRefreshCookie(res);
      res.status(401);
      throw new Error('Sesión revocada');
    }

    const tenant = await Tenant.findById(decoded.tenantId);
    if (!tenant || !tenant.estaActivo()) {
      res.status(403);
      throw new Error('Tenant inactivo o cancelado');
    }

    if (!decoded.jti) {
      res.status(401);
      throw new Error('Refresh token inválido (sin identificador de sesión)');
    }

    const jtiHash = RefreshToken.hashTokenId(decoded.jti);
    const tokenDoc = await RefreshToken.findOne({ jtiHash });

    if (!tokenDoc) {
      clearRefreshCookie(res);
      res.status(401);
      throw new Error('Sesión no encontrada o expirada');
    }

    // Detección de reúso de refresh token rotado/revocado: revocar toda la familia y sesiones del usuario
    if (tokenDoc.revokedAt) {
      await RefreshToken.revocarFamilia(tokenDoc.familyId, 'reuse_detected');
      await RefreshToken.revocarTodosDeUsuario(usuario._id, 'reuse_detected');
      usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
      await usuario.save();
      clearRefreshCookie(res);

      await audit(req, {
        accion: 'auth.refresh_reuse_detected',
        usuarioId: usuario._id,
        tenantId: tenant._id,
        resultado: 'denied',
        metadata: { familyId: tokenDoc.familyId },
      });

      res.status(401);
      throw new Error('Alerta de seguridad: intento de reutilización de token detectado. Se cerraron todas las sesiones.');
    }

    // Rotar refresh token
    const nuevoRefresh = await emitirRefreshToken(usuario, tenant._id, req, tokenDoc.familyId);
    tokenDoc.revokedAt = new Date();
    tokenDoc.revokedReason = 'rotated';
    tokenDoc.replacedByJtiHash = nuevoRefresh.jtiHash;
    tokenDoc.lastUsedAt = new Date();
    await tokenDoc.save();

    setRefreshCookie(res, nuevoRefresh.token);
    const accessToken = generarToken(usuario, tenant._id);

    res.json({ token: accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cerrar sesión actual (revocar refresh token en BD y limpiar cookie)
 * @route   POST /api/auth/logout
 * @access  Público
 */
const logout = async (req, res) => {
  const cookieToken = req.cookies?.refreshToken;
  if (cookieToken && mongoose.connection.readyState === 1) {
    try {
      const decoded = jwt.verify(cookieToken, getJwtRefreshSecret(), { algorithms: ['HS256'], ignoreExpiration: true });
      if (decoded?.jti) {
        const jtiHash = RefreshToken.hashTokenId(decoded.jti);
        await RefreshToken.findOneAndUpdate(
          { jtiHash, revokedAt: null },
          { $set: { revokedAt: new Date(), revokedReason: 'logout' } }
        );
      }
    } catch {
      // Si el token ya era inválido, igual limpiamos la cookie
    }
  }
  clearRefreshCookie(res);
  res.json({ mensaje: 'Sesión cerrada' });
};

/**
 * @desc    Cerrar todas las sesiones del usuario autenticado
 * @route   POST /api/auth/logout-all
 * @access  Privado
 */
const logoutAll = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id);
    if (usuario) {
      usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
      await usuario.save();
      await RefreshToken.revocarTodosDeUsuario(usuario._id, 'logout_all');
    }
    clearRefreshCookie(res);
    await audit(req, {
      accion: 'auth.logout_all',
      usuarioId: req.usuario._id,
      tenantId: req.usuario.tenantId,
      resultado: 'success',
    });
    res.json({ mensaje: 'Todas las sesiones han sido cerradas' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Listar sesiones activas del usuario autenticado
 * @route   GET /api/auth/sesiones
 * @access  Privado
 */
const listarSesiones = async (req, res, next) => {
  try {
    const sesiones = await RefreshToken.find({
      usuarioId: req.usuario._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select('familyId ip userAgent createdAt lastUsedAt expiresAt')
      .sort({ lastUsedAt: -1 });

    res.json({ sesiones });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Revocar una sesión específica del usuario autenticado
 * @route   DELETE /api/auth/sesiones/:id
 * @access  Privado
 */
const revocarSesion = async (req, res, next) => {
  try {
    const sesion = await RefreshToken.findOneAndUpdate(
      { _id: req.params.id, usuarioId: req.usuario._id, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'manual_revoke' } },
      { new: true }
    );
    if (!sesion) {
      res.status(404);
      throw new Error('Sesión no encontrada');
    }
    res.json({ mensaje: 'Sesión revocada correctamente' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Obtener perfil del usuario autenticado
 * @route   GET /api/auth/perfil
 * @access  Privado
 */
const obtenerPerfil = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select('-password');
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    let tenantInfo = null;
    if (usuario.tenantId) {
      tenantInfo = await Tenant.findById(usuario.tenantId).select('nombreFinca plan estado limites consumoActual emailAlias');
      if (tenantInfo && !tenantInfo.emailAlias) {
        const slug = (tenantInfo.nombreFinca || 'finca').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20);
        tenantInfo.emailAlias = `${slug}-${usuario._id.toString().slice(-4)}`;
        await Tenant.updateOne({ _id: tenantInfo._id }, { emailAlias: tenantInfo.emailAlias });
      }
    }

    const uObj = usuario.toJSON ? usuario.toJSON() : { ...usuario };
    res.json({
      ...uObj,
      tenant: tenantInfo,
      esSuperAdmin: usuario.isSuperAdmin === true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Actualizar perfil del usuario (créditos fiscales, datos de finca)
 * @route   PUT /api/auth/perfil
 * @access  Privado
 */
const actualizarPerfil = async (req, res, next) => {
  try {
    const { nombre, nombreFinca, cantidadHijos, tieneConyuge, cedula, telefono } = req.body;

    const usuario = await Usuario.findById(req.usuario._id);
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    if (nombre) usuario.nombre = String(nombre).trim().slice(0, 100);
    if (nombreFinca !== undefined) {
      const fincaLimpia = String(nombreFinca).trim().slice(0, 120);
      usuario.nombreFinca = fincaLimpia;
      if (req.tenant) {
        req.tenant.nombreFinca = fincaLimpia;
        await req.tenant.save();
      }
    }
    if (cantidadHijos !== undefined) usuario.cantidadHijos = Math.max(0, Math.min(20, Number(cantidadHijos) || 0));
    if (tieneConyuge !== undefined) usuario.tieneConyuge = Boolean(tieneConyuge);
    if (telefono !== undefined) {
      let telLimpio = String(telefono).trim();
      if (telLimpio) {
        const digits = telLimpio.replace(/\D/g, '');
        if (digits.length === 8) {
          telLimpio = `+506${digits}`;
        } else if (digits.startsWith('506') && digits.length === 11) {
          telLimpio = `+${digits}`;
        } else if (!telLimpio.startsWith('+')) {
          telLimpio = `+506${digits}`;
        }
      }
      usuario.telefono = telLimpio || undefined;
    }
    if (cedula !== undefined) {
      if (typeof cedula === 'string') {
        const numLimpio = cedula.replace(/[-\s]/g, '').trim();
        usuario.cedula = {
          tipo: numLimpio.length === 10 ? 'juridica' : 'fisica',
          numero: numLimpio,
        };
      } else if (typeof cedula === 'object' && cedula !== null) {
        const numLimpio = String(cedula.numero || '').replace(/[-\s]/g, '').trim();
        usuario.cedula = {
          tipo: cedula.tipo || (numLimpio.length === 10 ? 'juridica' : 'fisica'),
          numero: numLimpio,
        };
      }
    }

    const actualizado = await usuario.save();

    let tenantInfo = null;
    if (actualizado.tenantId) {
      tenantInfo = await Tenant.findById(actualizado.tenantId).select('nombreFinca plan estado limites consumoActual emailAlias');
    }

    res.json({
      _id: actualizado._id,
      nombre: actualizado.nombre,
      email: actualizado.email,
      telefono: actualizado.telefono,
      cedula: actualizado.cedula,
      nombreFinca: actualizado.nombreFinca,
      cantidadHijos: actualizado.cantidadHijos,
      tieneConyuge: actualizado.tieneConyuge,
      tenantId: actualizado.tenantId,
      tenant: tenantInfo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cambiar contraseña del usuario (incrementa tokenVersion y revoca sesiones)
 * @route   PUT /api/auth/cambiar-password
 * @access  Privado
 */
const cambiarPassword = async (req, res, next) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      res.status(400);
      throw new Error('Contraseña actual y nueva contraseña son obligatorios');
    }

    const validacion = validarPoliticaPassword(passwordNueva);
    if (!validacion.valido) {
      res.status(400);
      throw new Error(validacion.errores[0]);
    }

    const usuario = await Usuario.findById(req.usuario._id).select('+password');
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    const coincide = await usuario.compararPassword(passwordActual);
    if (!coincide) {
      res.status(401);
      throw new Error('La contraseña actual es incorrecta');
    }

    usuario.password = passwordNueva;
    usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
    await usuario.save();

    await RefreshToken.revocarTodosDeUsuario(usuario._id, 'password_change');

    await audit(req, {
      accion: 'auth.password_change',
      usuarioId: usuario._id,
      tenantId: usuario.tenantId,
      resultado: 'success',
    });

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Solicitar recuperación de contraseña (token aleatorio de 32 bytes, SHA-256 en BD, expira en 15m)
 * @route   POST /api/auth/forgot-password
 * @access  Público
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400);
      throw new Error('El email es obligatorio');
    }

    const emailLimpio = email.toLowerCase().trim();
    const usuario = await Usuario.findOne({ email: emailLimpio });

    if (usuario && !usuario.suspendido) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      usuario.passwordResetTokenHash = tokenHash;
      usuario.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
      await usuario.save();

      await audit(req, {
        accion: 'auth.password_reset_requested',
        usuarioId: usuario._id,
        tenantId: usuario.tenantId,
        resultado: 'success',
      });
    }

    // Respuesta idéntica exista o no el correo para evitar enumeración de cuentas
    res.json({
      mensaje: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Restablecer contraseña con token de un solo uso
 * @route   POST /api/auth/reset-password
 * @access  Público
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, passwordNueva } = req.body;
    if (!token || !passwordNueva || typeof token !== 'string' || typeof passwordNueva !== 'string') {
      res.status(400);
      throw new Error('Token y nueva contraseña son obligatorios');
    }

    const validacion = validarPoliticaPassword(passwordNueva);
    if (!validacion.valido) {
      res.status(400);
      throw new Error(validacion.errores[0]);
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const usuario = await Usuario.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password +passwordResetTokenHash +passwordResetExpires');

    if (!usuario) {
      res.status(400);
      throw new Error('El enlace de recuperación es inválido o ha expirado');
    }

    usuario.password = passwordNueva;
    usuario.passwordResetTokenHash = null;
    usuario.passwordResetExpires = null;
    usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
    usuario.loginAttempts = 0;
    usuario.lockUntil = null;
    await usuario.save();

    await RefreshToken.revocarTodosDeUsuario(usuario._id, 'password_reset');

    await audit(req, {
      accion: 'auth.password_reset_completed',
      usuarioId: usuario._id,
      tenantId: usuario.tenantId,
      resultado: 'success',
    });

    res.json({ mensaje: 'Contraseña restablecida exitosamente. Inicia sesión con tu nueva contraseña.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verificar email con token
 * @route   POST /api/auth/verify-email
 * @access  Público
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400);
      throw new Error('Token de verificación inválido');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const usuario = await Usuario.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationTokenHash +emailVerificationExpires');

    if (!usuario) {
      res.status(400);
      throw new Error('El token de verificación es inválido o ha expirado');
    }

    usuario.emailVerificado = true;
    usuario.emailVerificationTokenHash = null;
    usuario.emailVerificationExpires = null;
    await usuario.save();

    res.json({ mensaje: 'Correo electrónico verificado correctamente' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Iniciar configuración de MFA TOTP (genera secreto temporal + QR)
 * @route   POST /api/auth/mfa/setup
 * @access  Privado
 */
const mfaSetup = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select('+mfa.secretEncrypted');
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    const secret = generateTotpSecret();
    usuario.setMfaSecret(secret);
    usuario.mfa.enabled = false;
    await usuario.save();

    const otpauthUrl = buildOtpAuthUrl({
      secretBase32: secret,
      accountName: usuario.email,
      issuer: 'ContadorGanadero',
    });
    const qrDataUrl = QRCode ? await QRCode.toDataURL(otpauthUrl) : null;

    res.json({
      secret,
      otpauthUrl,
      qrDataUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirmar y activar MFA TOTP verificando el primer código y generando códigos de respaldo
 * @route   POST /api/auth/mfa/enable
 * @access  Privado
 */
const mfaEnable = async (req, res, next) => {
  try {
    const { totpCode } = req.body;
    const usuario = await Usuario.findById(req.usuario._id).select('+mfa.secretEncrypted +mfa.backupCodesHash');
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    const secret = usuario.getMfaSecret();
    if (!secret || !verifyTotpToken(secret, totpCode)) {
      res.status(400);
      throw new Error('Código TOTP inválido. Verifica la hora de tu dispositivo.');
    }

    const { plainCodes, hashedCodes } = generateBackupCodes(8);
    usuario.mfa.enabled = true;
    usuario.mfa.verifiedAt = new Date();
    usuario.mfa.backupCodesHash = hashedCodes;
    await usuario.save();

    await audit(req, {
      accion: 'auth.mfa_enabled',
      usuarioId: usuario._id,
      tenantId: usuario.tenantId,
      resultado: 'success',
    });

    res.json({
      mensaje: 'Autenticación de dos factores (2FA) activada correctamente.',
      backupCodes: plainCodes,
      recoveryCodes: plainCodes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Desactivar MFA TOTP (requiere contraseña actual)
 * @route   POST /api/auth/mfa/disable
 * @access  Privado
 */
const mfaDisable = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400);
      throw new Error('Debes confirmar tu contraseña actual para desactivar 2FA');
    }

    const usuario = await Usuario.findById(req.usuario._id).select('+password +mfa.secretEncrypted +mfa.backupCodesHash');
    if (!usuario || !(await usuario.compararPassword(password))) {
      res.status(401);
      throw new Error('Contraseña incorrecta');
    }

    usuario.mfa = {
      enabled: false,
      secretEncrypted: null,
      backupCodesHash: [],
      verifiedAt: null,
    };
    await usuario.save();

    await audit(req, {
      accion: 'auth.mfa_disabled',
      usuarioId: usuario._id,
      tenantId: usuario.tenantId,
      resultado: 'success',
    });

    res.json({ mensaje: 'Autenticación de dos factores desactivada' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Exportar datos personales y fiscales del usuario/tenant (Derecho ARCO - Ley 8968 CR)
 * @route   GET /api/auth/exportar-datos
 * @access  Privado
 */
const exportarMisDatos = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId;
    const [usuario, tenant, facturas, ingresos, inventario, costos, declaraciones] = await Promise.all([
      Usuario.findById(req.usuario._id),
      Tenant.findById(tenantId),
      Factura.find({ tenantId }).lean(),
      Ingreso.find({ tenantId }).lean(),
      Inventario.findOne({ tenantId }).lean(),
      CostoProduccion.find({ tenantId }).lean(),
      Declaracion.find({ tenantId }).lean(),
    ]);

    await audit(req, {
      accion: 'user.data_export_arco',
      usuarioId: req.usuario._id,
      tenantId,
      resultado: 'success',
    });

    res.json({
      fechaExportacion: new Date().toISOString(),
      normativa: 'Ley N.º 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales (Costa Rica)',
      usuario: usuario ? usuario.toJSON() : null,
      tenant: tenant ? tenant.toJSON() : null,
      datosContables: {
        facturas,
        ingresos,
        inventario,
        costosProduccion: costos,
        declaraciones,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registro,
  login,
  refrescarToken,
  logout,
  logoutAll,
  listarSesiones,
  revocarSesion,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  mfaSetup,
  mfaEnable,
  mfaDisable,
  exportarMisDatos,
  generarToken,
  emitirRefreshToken,
  setRefreshCookie,
};
