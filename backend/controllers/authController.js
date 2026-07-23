const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');

/**
 * Genera access token JWT con claims { id, tenantId, rol }
 */
const generarToken = (usuario, tenantId) => {
  return jwt.sign(
    { id: usuario._id, tenantId, rol: usuario.rol || 'dueño' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '1h' }
  );
};

/**
 * Genera refresh token JWT (mayor duración, sólo para renovar access)
 */
const generarRefreshToken = (usuario, tenantId) => {
  return jwt.sign(
    { id: usuario._id, tenantId, rol: usuario.rol || 'dueño', type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

/**
 * Setea cookie httpOnly con el refresh token
 */
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

const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', { path: '/api/auth' });
};

/**
 * @desc    Registrar nuevo usuario (crea implicitamente un Tenant)
 * @route   POST /api/auth/registro
 * @access  Público
 */
const registro = async (req, res, next) => {
  try {
    const { nombre, email, password, cedula, nombreFinca, cantidadHijos, tieneConyuge } = req.body;

    const existe = await Usuario.findOne({ email });
    if (existe) {
      res.status(400);
      throw new Error('Ya existe un usuario con ese email');
    }

    const tenant = await Tenant.crearParaUsuario({
      nombreFinca: nombreFinca || 'Mi Finca',
      owner: null,
      plan: 'free',
    });

    const usuario = await Usuario.create({
      nombre,
      email,
      password,
      cedula,
      nombreFinca,
      cantidadHijos,
      tieneConyuge,
      tenantId: tenant._id,
      rol: 'dueño',
    });

    tenant.owner = usuario._id;
    await tenant.save();

    const accessToken = generarToken(usuario, tenant._id);
    const refreshToken = generarRefreshToken(usuario, tenant._id);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      nombreFinca: usuario.nombreFinca,
      tenantId: tenant._id,
      plan: tenant.plan,
      rol: usuario.rol,
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
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Email y contraseña son obligatorios');
    }

    const usuario = await Usuario.findOne({ email }).select('+password');

    if (!usuario || !(await usuario.compararPassword(password))) {
      res.status(401);
      throw new Error('Credenciales incorrectas');
    }

    if (!usuario.tenantId) {
      res.status(403);
      throw new Error('Usuario sin tenant asociado. Ejecuta migrate:tenant para reparar.');
    }

    const tenant = await Tenant.findById(usuario.tenantId);
    if (!tenant) {
      res.status(403);
      throw new Error('Tenant asociado no encontrado. Contacta soporte.');
    }

    const accessToken = generarToken(usuario, tenant._id);
    const refreshToken = generarRefreshToken(usuario, tenant._id);
    setRefreshCookie(res, refreshToken);

    res.json({
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      nombreFinca: usuario.nombreFinca,
      tenantId: tenant._id,
      plan: tenant.plan,
      estadoTenant: tenant.estado,
      rol: usuario.rol,
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Renovar access token usando refresh token de la cookie
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

    const decoded = jwt.verify(cookieToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      res.status(401);
      throw new Error('Token inválido');
    }

    const usuario = await Usuario.findById(decoded.id).select('-password');
    if (!usuario) {
      res.status(401);
      throw new Error('Usuario no encontrado');
    }

    const tenant = await Tenant.findById(decoded.tenantId);
    if (!tenant || !tenant.estaActivo()) {
      res.status(403);
      throw new Error('Tenant inactivo o cancelado');
    }

    const accessToken = generarToken(usuario, tenant._id);
    res.json({ token: accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cerrar sesión (limpiar cookie refresh)
 * @route   POST /api/auth/logout
 * @access  Público
 */
const logout = async (req, res) => {
  clearRefreshCookie(res);
  res.json({ mensaje: 'Sesión cerrada' });
};

/**
 * @desc    Obtener perfil del usuario autenticado
 * @route   GET /api/auth/perfil
 * @access  Privado
 */
const obtenerPerfil = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select('-password');
    let tenantInfo = null;
    if (usuario?.tenantId) {
      tenantInfo = await Tenant.findById(usuario.tenantId).select('nombreFinca plan estado limites consumoActual');
    }
    res.json({ ...usuario.toObject(), tenant: tenantInfo });
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
    const { nombre, nombreFinca, cantidadHijos, tieneConyuge, cedula } = req.body;

    const usuario = await Usuario.findById(req.usuario._id);
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    if (nombre) usuario.nombre = nombre;
    if (nombreFinca !== undefined) {
      usuario.nombreFinca = nombreFinca;
      if (req.tenant) {
        req.tenant.nombreFinca = nombreFinca;
        await req.tenant.save();
      }
    }
    if (cantidadHijos !== undefined) usuario.cantidadHijos = cantidadHijos;
    if (tieneConyuge !== undefined) usuario.tieneConyuge = tieneConyuge;
    if (cedula) usuario.cedula = cedula;

    const actualizado = await usuario.save();

    res.json({
      _id: actualizado._id,
      nombre: actualizado.nombre,
      email: actualizado.email,
      nombreFinca: actualizado.nombreFinca,
      cantidadHijos: actualizado.cantidadHijos,
      tieneConyuge: actualizado.tieneConyuge,
      tenantId: actualizado.tenantId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cambiar contraseña del usuario
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

    if (passwordNueva.length < 8) {
      res.status(400);
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
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
    await usuario.save();

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registro,
  login,
  refrescarToken,
  logout,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
};
