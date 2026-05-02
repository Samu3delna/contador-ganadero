/**
 * Middleware centralizado de manejo de errores
 */

// Middleware para rutas no encontradas
const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Middleware centralizado de errores
const errorHandler = (err, req, res, next) => {
  // Si el status es 200, forzar a 500
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let mensaje = err.message;

  // Error de Mongoose: ID no válido
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    mensaje = 'Recurso no encontrado (ID inválido)';
  }

  // Error de Mongoose: validación
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errores = Object.values(err.errors).map((e) => e.message);
    mensaje = errores.join(', ');
  }

  // Error de Mongoose: duplicado
  if (err.code === 11000) {
    statusCode = 400;
    const campo = Object.keys(err.keyValue)[0];
    mensaje = `Ya existe un registro con ese ${campo}`;
  }

  res.status(statusCode).json({
    error: mensaje,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
