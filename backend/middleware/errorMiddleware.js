const logger = require('../utils/logger');

/**
 * Middleware centralizado de manejo de errores (Fail-Closed).
 * - Nunca devuelve stack traces, nombres de colecciones ni rutas internas en producción.
 * - Incluye correlationId (req.id) para trazabilidad segura.
 */

// Middleware para rutas no encontradas
const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Middleware centralizado de errores
const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  let statusCode = res.statusCode === 200 ? (err.statusCode || err.status || 500) : res.statusCode;
  let mensaje = err.message || 'Error interno del servidor';

  // Error de Mongoose: ID no válido
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    mensaje = 'Recurso no encontrado (ID inválido)';
  }

  // Error de Mongoose: validación
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errores = Object.values(err.errors || {}).map((e) => e.message);
    mensaje = errores.join(', ') || 'Datos de entrada inválidos';
  }

  // Error de Mongoose: duplicado (sin filtrar el valor ni detalles de esquema en producción)
  if (err.code === 11000) {
    statusCode = 400;
    const campo = err.keyValue ? Object.keys(err.keyValue)[0] : 'registro';
    mensaje = `Ya existe un registro con ese ${campo}`;
  }

  // Error de payload demasiado grande
  if (err.type === 'entity.too.large' || err.status === 413) {
    statusCode = 413;
    mensaje = 'El tamaño de la solicitud excede el límite permitido';
  }

  // Error de JSON malformado
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    mensaje = 'Formato JSON inválido';
  }

  // Registrar el error internamente con logger estructurado sin exponer secretos
  if (statusCode >= 500) {
    logger.error('Error interno en petición HTTP', {
      requestId: req?.id,
      method: req?.method,
      path: req?.originalUrl,
      statusCode,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    if (isProd) {
      mensaje = 'Error interno del servidor';
    }
  }

  const respuesta = {
    error: mensaje,
    correlationId: req?.id,
  };

  if (!isProd && err.stack) {
    respuesta.stack = err.stack;
  }

  res.status(statusCode).json(respuesta);
};

module.exports = { notFound, errorHandler };
