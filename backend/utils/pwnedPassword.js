/**
 * Validador de política de contraseñas (12-128 caracteres, complejidad, bloqueo de datos del usuario
 * y consulta k-anonimato contra Have I Been Pwned API enviando solo los primeros 5 chars del SHA-1).
 */

const crypto = require('crypto');
const axios = require('axios');

const COMMON_BREACHED_PASSWORDS = new Set([
  '123456789012',
  'password1234',
  'password12345',
  'qwertyuiop12',
  'admin1234567',
  'costarica2026',
  'demoseguro2026!',
  'contadorganadero',
]);

/**
 * Consulta la API de Have I Been Pwned usando k-anonimato (solo envía los primeros 5 caracteres hex del SHA-1).
 *
 * @param {string} password
 * @returns {Promise<{ comprometida: boolean, count?: number }>}
 */
async function verificarPasswordFiltradoHIBP(password) {
  const normalized = String(password || '');
  if (COMMON_BREACHED_PASSWORDS.has(normalized.toLowerCase())) {
    return { comprometida: true, count: 1 };
  }

  if (process.env.NODE_ENV === 'test' && process.env.ENABLE_HIBP_NETWORK_IN_TEST !== 'true') {
    return { comprometida: false, count: 0 };
  }

  try {
    const sha1 = crypto.createHash('sha1').update(normalized, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
      timeout: 2500,
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'ContadorGanadero-SecurityCheck',
      },
    });

    if (typeof response.data !== 'string') return { comprometida: false, count: 0 };
    const lines = response.data.split(/\r?\n/);
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      const count = Number.parseInt(countStr, 10);
      if (hashSuffix && hashSuffix.trim().toUpperCase() === suffix && count > 0) {
        return { comprometida: true, count };
      }
    }
    return { comprometida: false, count: 0 };
  } catch {
    return { comprometida: false, count: 0 };
  }
}

async function esPasswordFiltradaHIBP(password) {
  const res = await verificarPasswordFiltradoHIBP(password);
  return res.comprometida;
}

/**
 * Valida de forma síncrona la política de contraseñas:
 * - Entre 12 y 128 caracteres.
 * - Al menos una letra mayúscula, una minúscula y un número o símbolo.
 * - No vacía ni compuesta solo de espacios.
 * - No contiene el correo electrónico, nombre del usuario ni nombre de la finca.
 * - No pertenece a la lista local de contraseñas filtradas comunes.
 *
 * @param {string} password
 * @param {{ email?: string, nombre?: string, nombreFinca?: string, minLength?: number }} [context]
 * @returns {{ valido: boolean, valida: boolean, errores: string[], error?: string }}
 */
function validarPoliticaPassword(password, context = {}) {
  const errores = [];

  if (typeof password !== 'string' || password.trim().length === 0) {
    errores.push('La contraseña es obligatoria y no puede consistir únicamente en espacios.');
    return { valido: false, valida: false, errores, error: errores[0] };
  }

  const minLength = context.minLength || 12;
  if (password.length < minLength) {
    errores.push(`La contraseña debe tener al menos ${minLength} caracteres.`);
  }

  if (password.length > 128) {
    errores.push('La contraseña no puede superar los 128 caracteres.');
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errores.push('La contraseña debe incluir mayúsculas, minúsculas y números o caracteres especiales.');
  }

  const lowerPass = password.toLowerCase();
  if (COMMON_BREACHED_PASSWORDS.has(lowerPass)) {
    errores.push('Esta contraseña ha aparecido en filtraciones públicas de datos. Elige una contraseña diferente.');
  }

  if (context.email && typeof context.email === 'string') {
    const emailClean = context.email.trim().toLowerCase();
    const localPart = emailClean.split('@')[0];
    if ((emailClean && lowerPass.includes(emailClean)) || (localPart && localPart.length >= 4 && lowerPass.includes(localPart))) {
      errores.push('La contraseña no debe contener tu correo electrónico.');
    }
  }

  if (context.nombre && typeof context.nombre === 'string') {
    const tokens = context.nombre
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 4);
    if (tokens.some((t) => lowerPass.includes(t))) {
      errores.push('La contraseña no debe contener tu nombre.');
    }
  }

  if (context.nombreFinca && typeof context.nombreFinca === 'string') {
    const fincaClean = context.nombreFinca.trim().toLowerCase();
    if (fincaClean.length >= 4 && lowerPass.includes(fincaClean)) {
      errores.push('La contraseña no debe contener el nombre de la finca.');
    }
  }

  const ok = errores.length === 0;
  return {
    valido: ok,
    valida: ok,
    errores,
    error: errores[0],
  };
}

module.exports = {
  validarPoliticaPassword,
  verificarPasswordFiltradoHIBP,
  esPasswordFiltradaHIBP,
};
