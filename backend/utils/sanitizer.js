/**
 * Utilidades de sanitización para el chat IA.
 * - Validación de input del usuario
 * - Filtrado de PII (datos personales sensibles)
 * - Protección contra inyección de prompt
 */

// ============ CONSTANTES ============

const MAX_INPUT_LENGTH = 2000;
const MIN_INPUT_LENGTH = 1;

// Patrones de PII para Costa Rica
const PII_PATTERNS = [
  // Cédula costarricense: 1-1234-5678 o 101234567
  { regex: /\b\d{1}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CÉDULA_REDACTADA]' },
  // Cédula jurídica: 3-101-123456
  { regex: /\b\d{1}[-\s]?\d{3}[-\s]?\d{6}\b/g, replacement: '[CÉDULA_JURÍDICA_REDACTADA]' },
  // Email
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTADO]' },
  // Cuentas bancarias IBAN CR (CR + 2 dígitos + 18 dígitos)
  { regex: /\bCR\d{20}\b/gi, replacement: '[CUENTA_BANCARIA_REDACTADA]' },
  // Números de tarjeta de crédito (4 grupos de 4 dígitos)
  { regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[TARJETA_REDACTADA]' },
  // Teléfono CR: +506 8888-8888 o 88888888
  { regex: /\b(\+?506[-\s]?)?\d{4}[-\s]?\d{4}\b/g, replacement: '[TELÉFONO_REDACTADO]' },
];

// Patrones de inyección de prompt conocidos
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+/i,
  /new\s+instructions?:/i,
  /system\s*:\s*/i,
  /\[\s*SYSTEM\s*\]/i,
  /override\s+(system|prompt|instructions?)/i,
  /forget\s+(everything|all|your)/i,
  /act\s+as\s+(if|a|an)\s/i,
  /pretend\s+(you|to\s+be)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

// ============ FUNCIONES ============

/**
 * Sanitizar y validar input del usuario para el chat.
 * @param {string} texto - Texto del usuario
 * @returns {{ valido: boolean, texto: string, error?: string }}
 */
function sanitizarInput(texto) {
  if (!texto || typeof texto !== 'string') {
    return { valido: false, texto: '', error: 'Mensaje vacío o inválido' };
  }

  let limpio = texto.trim();

  if (limpio.length < MIN_INPUT_LENGTH) {
    return { valido: false, texto: '', error: 'Mensaje vacío' };
  }

  if (limpio.length > MAX_INPUT_LENGTH) {
    return { valido: false, texto: '', error: `Mensaje excede el límite de ${MAX_INPUT_LENGTH} caracteres` };
  }

  // Detectar intentos de inyección de prompt
  const inyeccionDetectada = PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(limpio));
  if (inyeccionDetectada) {
    console.warn('⚠️  Posible inyección de prompt detectada:', limpio.substring(0, 100));
    // No bloquear, pero limpiar — envolver en contexto claro
    limpio = `[PREGUNTA DEL USUARIO]: ${limpio}`;
  }

  // Eliminar caracteres de control (excepto newlines y tabs)
  limpio = limpio.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return { valido: true, texto: limpio };
}

/**
 * Filtrar PII del texto antes de enviarlo a la IA.
 * @param {string} texto
 * @returns {string} Texto con PII redactado
 */
function filtrarPII(texto) {
  if (!texto || typeof texto !== 'string') return texto;

  let resultado = texto;
  for (const { regex, replacement } of PII_PATTERNS) {
    // Crear nuevo regex para evitar problemas con lastIndex en regex globales
    const freshRegex = new RegExp(regex.source, regex.flags);
    resultado = resultado.replace(freshRegex, replacement);
  }
  return resultado;
}

/**
 * Sanitizar contexto completo antes de enviar a la IA.
 * Filtra PII de los datos del usuario.
 * @param {object} contexto - Objeto de contexto del usuario
 * @returns {object} Contexto sanitizado
 */
function sanitizarContexto(contexto) {
  if (!contexto) return contexto;

  const sanitizado = JSON.parse(JSON.stringify(contexto)); // Deep clone

  // Sanitizar nombres de emisores en facturas
  if (sanitizado.ultimasFacturas) {
    sanitizado.ultimasFacturas = sanitizado.ultimasFacturas.map(f => ({
      ...f,
      emisor: f.emisor ? filtrarPII(f.emisor) : f.emisor,
    }));
  }

  // Sanitizar conceptos de ingresos
  if (sanitizado.ultimosIngresos) {
    sanitizado.ultimosIngresos = sanitizado.ultimosIngresos.map(i => ({
      ...i,
      concepto: i.concepto ? filtrarPII(i.concepto) : i.concepto,
    }));
  }

  return sanitizado;
}

module.exports = {
  sanitizarInput,
  filtrarPII,
  sanitizarContexto,
  MAX_INPUT_LENGTH,
  // Exportar para testing
  PII_PATTERNS,
  PROMPT_INJECTION_PATTERNS,
};
