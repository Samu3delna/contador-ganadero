const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

/**
 * Middleware para proteger rutas que requieren autenticación
 * El JWT ahora se firma con payload { id, tenantId, rol }
 * Carga también tenantId y rol en req.usuario para uso downstream.
 */
const protegerRuta = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      if (!token) {
        res.status(401);
        throw new Error('No autorizado — Formato de token inválido');
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const usuario = await Usuario.findById(decoded.id).select('-password');

      if (!usuario) {
        res.status(401);
        throw new Error('Usuario no encontrado');
      }

      if (!usuario.tenantId && decoded.tenantId) {
        usuario.tenantId = decoded.tenantId;
      }
      usuario.rol = usuario.rol || decoded.rol || 'dueño';

      req.usuario = usuario;
      req.auth = decoded;

      next();
    } catch {
      res.status(401);
      next(new Error('No autorizado — Token inválido o expirado'));
    }
  } else {
    res.status(401);
    next(new Error('No autorizado — Token no proporcionado'));
  }
};

module.exports = { protegerRuta };
