const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

/**
 * Middleware para proteger rutas que requieren autenticación
 */
const protegerRuta = async (req, res, next) => {
  let token;

  // Verificar header Authorization: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Adjuntar usuario al request (sin contraseña)
      req.usuario = await Usuario.findById(decoded.id).select('-password');

      if (!req.usuario) {
        res.status(401);
        throw new Error('Usuario no encontrado');
      }

      next();
    } catch (error) {
      res.status(401);
      next(new Error('No autorizado — Token inválido o expirado'));
    }
  } else {
    res.status(401);
    next(new Error('No autorizado — Token no proporcionado'));
  }
};

module.exports = { protegerRuta };
