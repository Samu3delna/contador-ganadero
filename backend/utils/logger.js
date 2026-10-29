/**
 * Logger estructurado en formato JSON con redacción automática de secretos y PII.
 * Incluye middleware HTTP con identificador de correlación (req.id / X-Request-Id).
 */

const crypto = require('crypto');

const SENSITIVE_KEY_PATTERN = /^(password|passwordactual|passwordnueva|pin|pinp12|certificadop12|certificadop12base64|token|accesstoken|refreshtoken|secret|apikey|ai_api_key|gemini_api_key|authorization|cookie|set-cookie|imap_password|imappassword|googlerefreshtoken|googleaccesstoken|encrypteddek|cedula|iban|tarjeta|cvv)$/i;

/**
 * Redacta recursivamente claves sensibles y patrones obvios de secretos.
 */
function redactarValor(obj, depth = 0) {
  if (depth > 6 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Redactar tokens Bearer o cadenas hexadecimales largas de claves
    return obj
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
      .replace(/\bCR\d{20}\b/gi, '[IBAN_REDACTED]');
  }
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: redactarValor(obj.message, depth + 1),
      code: obj.code,
    };
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map((item) => redactarValor(item, depth + 1));
  }

  const limpio = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      limpio[k] = '[REDACTED]';
    } else {
      limpio[k] = redactarValor(v, depth + 1);
    }
  }
  return limpio;
}

function escribirLog(level, msg, meta = {}) {
  if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_LOGS !== 'true') {
    return;
  }
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    msg: typeof msg === 'string' ? redactarValor(msg) : String(msg),
    ...redactarValor(meta),
  };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'fatal') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  info: (msg, meta) => escribirLog('info', msg, meta),
  warn: (msg, meta) => escribirLog('warn', msg, meta),
  error: (msg, meta) => escribirLog('error', msg, meta),
  security: (msg, meta) => escribirLog('security', msg, meta),
  redactarValor,
};

/**
 * Middleware que asigna un identificador de petición (req.id) y registra la petición HTTP
 * sin exponer cabeceras de autorización, cookies ni cuerpos con secretos.
 */
function requestLoggerMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const safeId =
    typeof incomingId === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(incomingId)
      ? incomingId
      : crypto.randomUUID();

  req.id = safeId;
  res.setHeader('X-Request-Id', safeId);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('http_request', {
      requestId: safeId,
      method: req.method,
      path: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userId: req.usuario?._id ? String(req.usuario._id) : undefined,
      tenantId: req.tenant?._id
        ? String(req.tenant._id)
        : req.usuario?.tenantId
          ? String(req.usuario.tenantId)
          : undefined,
    });
  });

  next();
}

module.exports = {
  logger,
  requestLoggerMiddleware,
  redactarValor,
};
