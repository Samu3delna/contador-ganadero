/**
 * Implementación nativa RFC 6238 (TOTP) y RFC 4648 (Base32) usando node:crypto,
 * más generación y verificación de códigos de respaldo de un solo uso hasheados con SHA-256.
 */

const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(base32Str) {
  const clean = String(base32Str || '')
    .toUpperCase()
    .replace(/=+$/, '')
    .replace(/[^A-Z2-7]/g, '');

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Genera un secreto aleatorio de 20 bytes codificado en Base32 para apps autenticadoras.
 */
function generateTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

/**
 * Construye la URI estándar otpauth://totp/... para generar el código QR.
 */
function generateOtpAuthUri({ secret, secretBase32, email, accountName, issuer = 'ContadorGanadero' } = {}) {
  const sec = secret || secretBase32 || '';
  const acct = email || accountName || 'usuario';
  const label = encodeURIComponent(`${issuer}:${acct}`);
  const params = new URLSearchParams({
    secret: sec,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

const buildOtpAuthUrl = generateOtpAuthUri;

/**
 * Genera el código TOTP de 6 dígitos para un instante dado (por defecto Date.now()).
 */
function generateTotpToken(secretBase32, timestampMs = Date.now(), stepSeconds = 30) {
  const key = decodeBase32(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return String(otp).padStart(6, '0');
}

const generateTotpCode = generateTotpToken;

/**
 * Verifica un código TOTP de 6 dígitos con ventana de tolerancia de ±1 intervalo (±30s).
 * Soporta tanto verifyTotpToken(token, secret) como verifyTotpToken(secret, token).
 */
function verifyTotpToken(arg1, arg2, timestampMs = Date.now(), windowSteps = 1) {
  const s1 = String(arg1 || '').trim();
  const s2 = String(arg2 || '').trim();
  let cleanToken;
  let secretBase32;

  if (/^[0-9]{6}$/.test(s1) && !/^[0-9]{6}$/.test(s2)) {
    cleanToken = s1;
    secretBase32 = s2;
  } else {
    secretBase32 = s1;
    cleanToken = s2;
  }

  if (!/^[0-9]{6}$/.test(cleanToken) || !secretBase32) return false;

  for (let w = -windowSteps; w <= windowSteps; w++) {
    const candidate = generateTotpToken(secretBase32, timestampMs + w * 30000);
    const a = Buffer.from(cleanToken, 'utf8');
    const b = Buffer.from(candidate, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

/**
 * Calcula el hash SHA-256 de un código de respaldo normalizado.
 */
function hashBackupCode(rawCode) {
  const normalized = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(`mfa-backup:${normalized}`).digest('hex');
}

/**
 * Genera códigos de respaldo de un solo uso y sus respectivos hashes SHA-256.
 * @returns {{ plainCodes: string[], hashedCodes: string[] }}
 */
function generateBackupCodes(count = 8) {
  const plainCodes = [];
  const hashedCodes = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${part1}-${part2}`;
    plainCodes.push(code);
    hashedCodes.push(hashBackupCode(code));
  }
  return { plainCodes, hashedCodes };
}

/**
 * Verifica y consume un código de respaldo contra la lista de hashes almacenados.
 */
function verifyBackupCode(rawCode, storedHashes = []) {
  if (!rawCode || !Array.isArray(storedHashes) || storedHashes.length === 0) {
    return { valid: false, remainingHashes: storedHashes || [] };
  }
  const candidateHash = hashBackupCode(rawCode);
  const candidateBuf = Buffer.from(candidateHash, 'utf8');

  let matchedIndex = -1;
  for (let i = 0; i < storedHashes.length; i++) {
    const hBuf = Buffer.from(String(storedHashes[i] || ''), 'utf8');
    if (hBuf.length === candidateBuf.length && crypto.timingSafeEqual(hBuf, candidateBuf)) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    return { valid: false, remainingHashes: storedHashes };
  }

  const remainingHashes = storedHashes.filter((_, idx) => idx !== matchedIndex);
  return { valid: true, remainingHashes };
}

module.exports = {
  generateTotpSecret,
  generateOtpAuthUri,
  buildOtpAuthUrl,
  generateTotpToken,
  generateTotpCode,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
};
