/**
 * Middleware de validación estricta de entradas, bloqueo de inyección NoSQL ($ne, $where, etc.),
 * protección contra Prototype Pollution (__proto__, constructor, prototype) y constructor
 * de esquemas declarativos compatibles con la API de Zod (.strict()).
 */

const FORBIDDEN_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const FORBIDDEN_PRIVILEGE_KEYS = new Set(['rol', 'tenantId', 'plan', 'estado', 'isSuperAdmin', 'esSuperAdmin', 'tokenVersion']);

/**
 * Inspecciona recursivamente un objeto para detectar claves de operadores NoSQL ($...)
 * o claves de contaminación de prototipos (__proto__, constructor, prototype).
 * @param {any} value
 * @param {number} [depth=0]
 * @returns {string | null} Nombre de la clave prohibida encontrada o null si es seguro.
 */
function detectarClavePeligrosa(value, depth = 0) {
  if (depth > 10) return 'MAX_DEPTH_EXCEEDED';
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const hallazgo = detectarClavePeligrosa(item, depth + 1);
      if (hallazgo) return hallazgo;
    }
    return null;
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_PROTOTYPE_KEYS.has(key)) return key;
    if (key.startsWith('$') || key.includes('.')) return key;
    const nested = detectarClavePeligrosa(value[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

/**
 * Clona de forma segura un objeto del usuario filtrando __proto__, constructor, prototype,
 * claves de operadores ($) y opcionalmente restringiendo a una lista blanca de propiedades.
 * @param {any} source
 * @param {string[] | null} [allowedKeys=null]
 * @param {number} [depth=0]
 */
function sanitizarObjetoUsuario(source, allowedKeys = null, depth = 0) {
  if (depth > 8 || source === null || source === undefined || typeof source !== 'object') {
    return source;
  }
  if (source instanceof Date) return new Date(source.getTime());
  if (Array.isArray(source)) {
    return source.slice(0, 1000).map((item) => sanitizarObjetoUsuario(item, null, depth + 1));
  }

  const allowedSet = Array.isArray(allowedKeys) ? new Set(allowedKeys) : null;
  const target = {};
  for (const [key, val] of Object.entries(source)) {
    if (FORBIDDEN_PROTOTYPE_KEYS.has(key)) continue;
    if (key.startsWith('$') || key.includes('.')) continue;
    if (allowedSet && !allowedSet.has(key)) continue;
    target[key] = sanitizarObjetoUsuario(val, null, depth + 1);
  }
  return target;
}

// ============================================================================
// Constructor ligero de esquemas compatible con Zod (z.object, .strict(), etc.)
// ============================================================================

class BaseSchema {
  constructor(validatorFn) {
    this._validate = validatorFn;
    this._optional = false;
    this._nullable = false;
    this._defaultVal = undefined;
  }

  optional() {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    clone._optional = true;
    return clone;
  }

  nullable() {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    clone._nullable = true;
    return clone;
  }

  default(val) {
    const clone = this.optional();
    clone._defaultVal = val;
    return clone;
  }

  safeParse(value) {
    if (value === undefined) {
      if (this._defaultVal !== undefined) return { success: true, data: this._defaultVal };
      if (this._optional) return { success: true, data: undefined };
      return { success: false, error: 'Campo requerido' };
    }
    if (value === null) {
      if (this._nullable) return { success: true, data: null };
      return { success: false, error: 'No puede ser nulo' };
    }
    return this._validate(value);
  }
}

const z = {
  string() {
    let minLen = 0;
    let maxLen = 10000;
    let regexPattern = null;
    let isEmail = false;
    let shouldTrim = false;

    const schema = new BaseSchema((val) => {
      if (typeof val !== 'string') return { success: false, error: 'Se esperaba texto (string)' };
      const v = shouldTrim ? val.trim() : val;
      if (v.length < minLen) return { success: false, error: `Longitud mínima: ${minLen}` };
      if (v.length > maxLen) return { success: false, error: `Longitud máxima: ${maxLen}` };
      if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return { success: false, error: 'Formato de correo inválido' };
      }
      if (regexPattern && !regexPattern.test(v)) {
        return { success: false, error: 'Formato inválido' };
      }
      return { success: true, data: v };
    });

    schema.min = (n) => { minLen = n; return schema; };
    schema.max = (n) => { maxLen = n; return schema; };
    schema.email = () => { isEmail = true; return schema; };
    schema.regex = (r) => { regexPattern = r; return schema; };
    schema.trim = () => { shouldTrim = true; return schema; };
    return schema;
  },

  number() {
    let minVal = -Infinity;
    let maxVal = Infinity;
    let isInt = false;
    let coerce = false;

    const schema = new BaseSchema((val) => {
      const n = coerce && typeof val === 'string' && val.trim() !== '' ? Number(val) : val;
      if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n)) {
        return { success: false, error: 'Se esperaba número válido' };
      }
      if (isInt && !Number.isInteger(n)) return { success: false, error: 'Se esperaba número entero' };
      if (n < minVal) return { success: false, error: `Valor mínimo: ${minVal}` };
      if (n > maxVal) return { success: false, error: `Valor máximo: ${maxVal}` };
      return { success: true, data: n };
    });

    schema.min = (n) => { minVal = n; return schema; };
    schema.max = (n) => { maxVal = n; return schema; };
    schema.int = () => { isInt = true; return schema; };
    schema.coerce = () => { coerce = true; return schema; };
    return schema;
  },

  boolean() {
    return new BaseSchema((val) => {
      if (typeof val !== 'boolean') return { success: false, error: 'Se esperaba booleano' };
      return { success: true, data: val };
    });
  },

  any() {
    return new BaseSchema((val) => {
      const peligrosa = detectarClavePeligrosa(val);
      if (peligrosa) return { success: false, error: `Clave no permitida: ${peligrosa}` };
      return { success: true, data: sanitizarObjetoUsuario(val) };
    });
  },

  enum(values) {
    const allowed = new Set(values);
    return new BaseSchema((val) => {
      if (!allowed.has(val)) return { success: false, error: 'Valor fuera de catálogo permitido' };
      return { success: true, data: val };
    });
  },

  array(itemSchema) {
    let maxItems = 1000;
    let minItems = 0;
    const schema = new BaseSchema((val) => {
      if (!Array.isArray(val)) return { success: false, error: 'Se esperaba arreglo' };
      if (val.length < minItems || val.length > maxItems) {
        return { success: false, error: 'Longitud de arreglo inválida' };
      }
      const out = [];
      for (const item of val) {
        if (itemSchema) {
          const r = itemSchema.safeParse(item);
          if (!r.success) return r;
          out.push(r.data);
        } else {
          out.push(sanitizarObjetoUsuario(item));
        }
      }
      return { success: true, data: out };
    });
    schema.max = (n) => { maxItems = n; return schema; };
    schema.min = (n) => { minItems = n; return schema; };
    return schema;
  },

  object(shape = {}) {
    let isStrict = false;
    const schema = new BaseSchema((val) => {
      if (!val || typeof val !== 'object' || Array.isArray(val)) {
        return { success: false, error: 'Se esperaba un objeto JSON' };
      }
      const peligrosa = detectarClavePeligrosa(val);
      if (peligrosa) {
        return { success: false, error: `Clave no permitida: ${peligrosa}` };
      }

      const shapeKeys = new Set(Object.keys(shape));
      if (isStrict) {
        for (const k of Object.keys(val)) {
          if (!shapeKeys.has(k)) {
            return { success: false, error: `Campo desconocido no permitido: ${k}` };
          }
        }
      }

      const output = {};
      for (const [k, fieldSchema] of Object.entries(shape)) {
        const res = fieldSchema.safeParse(val[k]);
        if (!res.success) {
          return { success: false, error: `${k}: ${res.error}` };
        }
        if (res.data !== undefined) {
          output[k] = res.data;
        }
      }
      return { success: true, data: output };
    });

    schema.strict = () => {
      isStrict = true;
      return schema;
    };
    return schema;
  },
};

/**
 * Middleware reutilizable `validar(schema)` que valida `{ body, query, params }`
 * o directamente `req.body` y responde 400 con mensaje genérico cuando falla.
 */
function validar(schema) {
  return (req, res, next) => {
    // 1. Bloquear operadores NoSQL y Prototype Pollution en body, query y params
    const peligrosaBody = detectarClavePeligrosa(req.body);
    const peligrosaQuery = detectarClavePeligrosa(req.query);
    const peligrosaParams = detectarClavePeligrosa(req.params);

    if (peligrosaBody || peligrosaQuery || peligrosaParams) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos.',
        codigo: 'INVALID_INPUT',
      });
    }

    if (!schema) return next();

    // Si el esquema define { body, query, params } por separado
    if (schema.body || schema.query || schema.params) {
      if (schema.body) {
        const rb = schema.body.safeParse(req.body || {});
        if (!rb.success) {
          return res.status(400).json({ error: 'Datos de entrada inválidos.', codigo: 'INVALID_INPUT' });
        }
        req.body = rb.data;
      }
      if (schema.query) {
        const rq = schema.query.safeParse(req.query || {});
        if (!rq.success) {
          return res.status(400).json({ error: 'Parámetros de consulta inválidos.', codigo: 'INVALID_QUERY' });
        }
        req.query = rq.data;
      }
      if (schema.params) {
        const rp = schema.params.safeParse(req.params || {});
        if (!rp.success) {
          return res.status(400).json({ error: 'Parámetros de ruta inválidos.', codigo: 'INVALID_PARAMS' });
        }
        req.params = rp.data;
      }
      return next();
    }

    // Si se pasó directamente un esquema para req.body
    if (typeof schema.safeParse === 'function') {
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Datos de entrada inválidos.', codigo: 'INVALID_INPUT' });
      }
      req.body = parsed.data;
    }

    return next();
  };
}

/**
 * Middleware global que bloquea operadores NoSQL ($ne, $gt, $where, etc.),
 * contaminación de prototipos (__proto__, constructor, prototype) y elimina
 * campos de escalación de privilegios en rutas de usuario.
 */
function sanitizarEntradasGlobal(req, res, next) {
  const peligrosaBody = detectarClavePeligrosa(req.body);
  const peligrosaQuery = detectarClavePeligrosa(req.query);
  const peligrosaParams = detectarClavePeligrosa(req.params);

  if (peligrosaBody || peligrosaQuery || peligrosaParams) {
    return res.status(400).json({
      error: 'Datos de entrada inválidos.',
      codigo: 'NOSQL_INJECTION_BLOCKED',
    });
  }

  // En cualquier ruta que no sea de administración de plataforma (/api/admin),
  // impedir que el cliente inyecte rol, tenantId, plan, estado o isSuperAdmin en req.body
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && !req.path.startsWith('/api/admin')) {
    for (const privKey of FORBIDDEN_PRIVILEGE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(req.body, privKey)) {
        delete req.body[privKey];
      }
    }
  }

  return next();
}

module.exports = {
  z,
  validar,
  sanitizarEntradasGlobal,
  sanitizarObjetoUsuario,
  detectarClavePeligrosa,
  FORBIDDEN_PROTOTYPE_KEYS,
  FORBIDDEN_PRIVILEGE_KEYS,
};
