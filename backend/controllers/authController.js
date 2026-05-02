const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// Generar JWT
const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1h',
  });
};

/**
 * @desc    Registrar nuevo usuario
 * @route   POST /api/auth/registro
 * @access  Público
 */
const registro = async (req, res, next) => {
  try {
    const { nombre, email, password, cedula, nombreFinca, cantidadHijos, tieneConyuge } = req.body;

    // Verificar si ya existe
    const existe = await Usuario.findOne({ email });
    if (existe) {
      res.status(400);
      throw new Error('Ya existe un usuario con ese email');
    }

    const usuario = await Usuario.create({
      nombre,
      email,
      password,
      cedula,
      nombreFinca,
      cantidadHijos,
      tieneConyuge,
    });

    res.status(201).json({
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      nombreFinca: usuario.nombreFinca,
      token: generarToken(usuario._id),
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

    // Buscar usuario incluyendo password (select: false por defecto)
    const usuario = await Usuario.findOne({ email }).select('+password');

    if (!usuario || !(await usuario.compararPassword(password))) {
      res.status(401);
      throw new Error('Credenciales incorrectas');
    }

    res.json({
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      nombreFinca: usuario.nombreFinca,
      token: generarToken(usuario._id),
    });
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
    res.json(req.usuario);
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
    if (nombreFinca !== undefined) usuario.nombreFinca = nombreFinca;
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
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registro, login, obtenerPerfil, actualizarPerfil };
