/**
 * Módulo central de validación de variables de entorno y secretos (Fail-Closed).
 * Valida al arrancar que existan todas las variables críticas, que los secretos
 * tengan al menos 32 caracteres (o 64 hex para claves de cifrado de 256 bits) y
 * que nunca se impriman valores de secretos en logs ni errores.
 */

const FORBIDDEN_DEFAULT_SECRETS = new Set([
  'contador_ganadero_jwt_secret_default_key',
  'contador_ganadero_jwt_refresh_default_key',
  'contador_ganadero_wa_secret',
  'secret',
  'changeme',
  'default_secret',
]);

function esPlaceholder(valor) {
  if (!valor || typeof valor !== 'string') return true;
  const v = valor.trim().toLowerCase();
  return (
    FORBIDDEN_DEFAULT_SECRETS.has(v) ||
    v.includes('tu_usuario') ||
    v.includes('tu_jwt_secret') ||
    v.includes('de_ejemplo') ||
    v.includes('reemplazar_con_') ||
    v.includes('generar_con_crypto') ||
    v.startsWith('placeholder_') ||
    v.startsWith('tu_')
  );
}

/**
 * Obtiene la lista exacta de orígenes permitidos para CORS.
 */
function getAllowedOrigins(envObj = process.env) {
  const raw = envObj.CORS_ORIGINS || envObj.FRONTEND_URL || '';
  const fromEnv = String(raw)
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  if (envObj.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:5173'];
  }

  return [];
}

/**
 * Compara un Origin contra la lista exacta de orígenes permitidos (sin sufijos ni comodines).
 */
function isOriginAllowed(origin, envObj = process.env) {
  if (!origin || typeof origin !== 'string') return false;
  const normalized = origin.trim().replace(/\/+$/, '');
  const allowed = getAllowedOrigins(envObj);
  return allowed.includes(normalized);
}

/**
 * Obtiene el número de saltos de proxy de confianza (por defecto 1).
 */
function getTrustProxyHops(envObj = process.env) {
  if (envObj && envObj.TRUST_PROXY_HOPS !== undefined) {
    const parsed = Number.parseInt(envObj.TRUST_PROXY_HOPS, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 1;
}

/**
 * Valida las variables de entorno críticas.
 * Soporta tanto `validarEntorno({ env, allowTestDefaults, exitOnError })` como `validarEntorno(envObj, options)`.
 */
function validarEntorno(arg1 = process.env, arg2 = {}) {
  let envObj = process.env;
  let options = {};

  if (
    arg1 &&
    typeof arg1 === 'object' &&
    ('env' in arg1 || 'exitOnError' in arg1 || 'allowTestDefaults' in arg1 || 'requireWebhooks' in arg1) &&
    !('MONGODB_URI' in arg1) &&
    !('JWT_SECRET' in arg1)
  ) {
    envObj = arg1.env || process.env;
    options = arg1;
  } else {
    envObj = arg1 || process.env;
    options = arg2 || {};
  }

  const errores = [];
  const isProd = envObj.NODE_ENV === 'production';
  const requireWebhooks = options.requireWebhooks ?? isProd;
  const exitOnError = options.exitOnError !== undefined ? options.exitOnError : true;

  // 1. Base de datos (MONGODB_URI o MONGO_URI)
  const mongoUri = envObj.MONGODB_URI || envObj.MONGO_URI;
  if (!mongoUri || esPlaceholder(mongoUri) || !/^mongodb(\+srv)?:\/\//.test(mongoUri.trim())) {
    errores.push('MONGODB_URI (o MONGO_URI) es obligatoria y debe tener un formato mongodb:// o mongodb+srv:// válido.');
  }

  // 2. JWT_SECRET (>= 32 caracteres)
  const jwtSecret = envObj.JWT_SECRET;
  if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.trim().length < 32 || esPlaceholder(jwtSecret)) {
    errores.push('JWT_SECRET es obligatorio y debe tener al menos 32 caracteres de alta entropía.');
  }

  // 3. JWT_REFRESH_SECRET / REFRESH_SECRET (>= 32 caracteres y distinto de JWT_SECRET)
  const refreshSecret = envObj.JWT_REFRESH_SECRET || envObj.REFRESH_SECRET;
  if (!refreshSecret || typeof refreshSecret !== 'string' || refreshSecret.trim().length < 32 || esPlaceholder(refreshSecret)) {
    errores.push('JWT_REFRESH_SECRET (o REFRESH_SECRET) es obligatorio y debe tener al menos 32 caracteres.');
  } else if (jwtSecret && refreshSecret.trim() === jwtSecret.trim()) {
    errores.push('JWT_REFRESH_SECRET y JWT_SECRET deben ser distintos.');
  }

  // 4. Clave de cifrado EMAIL_ENC_KEY (exactamente 64 caracteres hex = 32 bytes)
  const encKey = envObj.EMAIL_ENC_KEY;
  if (!encKey || typeof encKey !== 'string' || !/^[0-9a-fA-F]{64}$/.test(encKey.trim())) {
    errores.push('EMAIL_ENC_KEY es obligatoria y debe tener exactamente 64 caracteres hexadecimales (32 bytes).');
  }

  // 5. KEK maestra opcional para Envelope Encryption (si se define, debe ser 64 hex)
  if (envObj.MASTER_KEK_CURRENT && !/^[0-9a-fA-F]{64}$/.test(envObj.MASTER_KEK_CURRENT.trim())) {
    errores.push('MASTER_KEK_CURRENT debe tener exactamente 64 caracteres hexadecimales (32 bytes).');
  }

  // 6. CORS_ORIGINS o FRONTEND_URL (orígenes exactos sin comodines)
  const corsOriginsRaw = envObj.CORS_ORIGINS || envObj.FRONTEND_URL;
  if (!corsOriginsRaw || typeof corsOriginsRaw !== 'string' || !corsOriginsRaw.trim()) {
    errores.push('CORS_ORIGINS o FRONTEND_URL es obligatoria (lista de orígenes exactos separados por comas).');
  } else {
    const origenes = corsOriginsRaw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (origenes.length === 0) {
      errores.push('CORS_ORIGINS debe contener al menos un origen válido.');
    }
    for (const origen of origenes) {
      if (origen === '*' || origen.includes('*')) {
        errores.push('CORS_ORIGINS no permite comodines (*).');
        break;
      }
      try {
        const parsed = new URL(origen);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
          errores.push('CORS_ORIGINS contiene un origen con ruta o protocolo inválido (usar solo protocolo://host[:puerto]).');
          break;
        }
      } catch {
        errores.push('CORS_ORIGINS contiene una URL mal formada.');
        break;
      }
    }
  }

  // 7. Secretos de webhooks (>= 32 caracteres cuando están presentes o en producción)
  const webhookVars = ['ONVO_WEBHOOK_SECRET', 'EMAIL_WEBHOOK_SECRET'];

  for (const varName of webhookVars) {
    const val = envObj[varName];
    if (requireWebhooks && (!val || typeof val !== 'string' || val.trim().length < 32 || esPlaceholder(val))) {
      errores.push(`${varName} es obligatorio y debe tener al menos 32 caracteres.`);
    } else if (val && (val.trim().length < 32 || esPlaceholder(val))) {
      errores.push(`${varName} debe tener al menos 32 caracteres.`);
    }
  }

  if (envObj.WHATSAPP_VERIFY_TOKEN && esPlaceholder(envObj.WHATSAPP_VERIFY_TOKEN)) {
    errores.push('WHATSAPP_VERIFY_TOKEN no puede usar un valor por defecto débil.');
  }

  if (errores.length > 0) {
    if (exitOnError) {
      const err = new Error(`Configuración de entorno inválida:\n - ${errores.join('\n - ')}`);
      err.code = 'INVALID_ENV_CONFIG';
      err.errors = errores;
      throw err;
    }
    return { ok: false, errors: errores };
  }

  const origenesPermitidos = corsOriginsRaw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const trustProxyHops = getTrustProxyHops(envObj);

  return {
    ok: true,
    errors: [],
    NODE_ENV: envObj.NODE_ENV || 'development',
    PORT: Number.parseInt(envObj.PORT || '5000', 10),
    MONGODB_URI: mongoUri.trim(),
    JWT_SECRET: jwtSecret.trim(),
    JWT_REFRESH_SECRET: refreshSecret.trim(),
    EMAIL_ENC_KEY: encKey.trim(),
    MASTER_KEK_ID: (envObj.MASTER_KEK_ID || 'k1').trim(),
    MASTER_KEK_CURRENT: (envObj.MASTER_KEK_CURRENT || encKey).trim(),
    CORS_ORIGINS: origenesPermitidos,
    TRUST_PROXY_HOPS: trustProxyHops,
  };
}

/**
 * Obtiene el secreto de firma de Access Token sin permitir valores por defecto.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32 || FORBIDDEN_DEFAULT_SECRETS.has(secret.trim())) {
    throw new Error('JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres).');
  }
  return secret.trim();
}

/**
 * Obtiene el secreto de firma de Refresh Token sin permitir fallback a JWT_SECRET.
 */
function getJwtRefreshSecret() {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.REFRESH_SECRET;
  if (!refreshSecret || refreshSecret.trim().length < 32 || FORBIDDEN_DEFAULT_SECRETS.has(refreshSecret.trim())) {
    throw new Error('JWT_REFRESH_SECRET no configurado o demasiado corto (mínimo 32 caracteres).');
  }
  if (process.env.JWT_SECRET && refreshSecret.trim() === process.env.JWT_SECRET.trim()) {
    throw new Error('JWT_REFRESH_SECRET debe ser distinto de JWT_SECRET.');
  }
  return refreshSecret.trim();
}

module.exports = {
  validarEntorno,
  getJwtSecret,
  getJwtRefreshSecret,
  getAllowedOrigins,
  isOriginAllowed,
  getTrustProxyHops,
  FORBIDDEN_DEFAULT_SECRETS,
};
