/**
 * Utilidad de cifrado simétrico autenticado AES-256-GCM con AAD (Additional Authenticated Data)
 * y soporte de Envelope Encryption (KeyProvider).
 *
 * Formato actual (v2):
 *   v2:<keyId>:<ivBase64>:<authTagBase64>:<ciphertextBase64>
 *   - Algoritmo: aes-256-gcm
 *   - IV: 12 bytes aleatorios por operación (crypto.randomBytes(12))
 *   - AuthTag: 16 bytes verificados obligatoriamente al descifrar
 *   - AAD: vincula el texto cifrado a `${tenantId}:${field}` para impedir que un secreto
 *          cifrado de una organización o campo sea copiado a otro.
 *
 * Compatibilidad hacia atrás (v1 legado):
 *   Soporta lectura de valores antiguos `<32-hex-iv>:<hex-cipher>` cifrados con aes-256-cbc
 *   durante la migración a v2.
 */

const crypto = require('crypto');
const { KeyProvider, GCM_ALGO, IV_LENGTH, AUTH_TAG_LENGTH } = require('./keyProvider');

const LEGACY_CBC_ALGO = 'aes-256-cbc';
const V2_PREFIX = 'v2:';

function isConfigured() {
  const encKey = (process.env.MASTER_KEK_CURRENT || process.env.EMAIL_ENC_KEY || '').trim();
  return /^[0-9a-fA-F]{64}$/.test(encKey);
}

/**
 * Construye el buffer de datos autenticados adicionales (AAD).
 * @param {{ tenantId?: string, field?: string, aad?: string }} [options]
 * @returns {Buffer}
 */
function buildAadBuffer(options = {}) {
  if (options.aad) {
    return Buffer.from(String(options.aad), 'utf8');
  }
  const tenantPart = options.tenantId ? String(options.tenantId) : 'global';
  const fieldPart = options.field || options.fieldName ? String(options.field || options.fieldName) : 'secret';
  return Buffer.from(`${tenantPart}:${fieldPart}`, 'utf8');
}

/**
 * Determina si una cadena ya se encuentra cifrada en formato v2 (GCM) o v1 legado (CBC).
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith(V2_PREFIX)) {
    const parts = value.split(':');
    return parts.length === 5;
  }
  // Formato legado v1: <32-hex-iv>:<hex-ciphertext>
  return /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(value);
}

/**
 * Determina si un valor está cifrado específicamente con el formato moderno v2 (AES-256-GCM).
 * @param {string} value
 * @returns {boolean}
 */
function isEncryptedV2(value) {
  return typeof value === 'string' && value.startsWith(V2_PREFIX) && value.split(':').length === 5;
}

/**
 * Cifra un texto en claro usando AES-256-GCM con IV aleatorio de 12 bytes, tag de 16 bytes y AAD.
 * Si el valor ya está cifrado en v2 (y no se fuerza re-cifrado), lo retorna intacto.
 *
 * @param {string} plainText
 * @param {{ tenantId?: string, field?: string, aad?: string, dekBuffer?: Buffer }} [options]
 * @returns {string}
 */
function encryptText(plainText, options = {}) {
  if (!plainText || typeof plainText !== 'string') return plainText;
  if (isEncryptedV2(plainText)) return plainText;

  if (!isConfigured() && !options.dekBuffer) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_ENC_KEY / MASTER_KEK_CURRENT es obligatoria para cifrar secretos en producción.');
    }
    return plainText;
  }

  let keyId = 'dek';
  let keyBuffer = options.dekBuffer;
  if (!keyBuffer) {
    const activeKek = KeyProvider.getActiveKek();
    keyId = activeKek.keyId;
    keyBuffer = activeKek.keyBuffer;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const aadBuffer = buildAadBuffer(options);

  const cipher = crypto.createCipheriv(GCM_ALGO, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
  cipher.setAAD(aadBuffer);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${V2_PREFIX}${keyId}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Descifra un texto cifrado en formato v2 (AES-256-GCM + AAD) o formato legado v1 (AES-256-CBC).
 * Lanza un error criptográfico si el ciphertext, el IV, el AuthTag o el AAD fueron alterados.
 *
 * @param {string} cipherText
 * @param {{ tenantId?: string, field?: string, aad?: string, dekBuffer?: Buffer, strict?: boolean }} [options]
 * @returns {string}
 */
function decryptText(cipherText, options = {}) {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;

  // 1. Formato moderno v2: AES-256-GCM con verificación de AuthTag y AAD
  if (cipherText.startsWith(V2_PREFIX)) {
    const parts = cipherText.split(':');
    if (parts.length !== 5) {
      throw new Error('Formato de texto cifrado v2 inválido.');
    }
    const [, keyId, ivB64, tagB64, encryptedB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Parámetros GCM inválidos (IV o AuthTag corruptos).');
    }

    const keyBuffer = keyId === 'dek' && options.dekBuffer
      ? options.dekBuffer
      : KeyProvider.getKekById(keyId);

    const aadBuffer = buildAadBuffer(options);
    const decipher = crypto.createDecipheriv(GCM_ALGO, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAAD(aadBuffer);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  // 2. Formato legado v1: <32-hex-iv>:<hex-cipher> (AES-256-CBC) — solo lectura compatible
  if (/^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(cipherText)) {
    const legacyHex = (process.env.EMAIL_ENC_KEY || process.env.MASTER_KEK_CURRENT || '').trim();
    if (!/^[0-9a-fA-F]{64}$/.test(legacyHex)) {
      throw new Error('EMAIL_ENC_KEY no disponible para descifrar dato legado v1.');
    }
    const [ivHex, encryptedHex] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(legacyHex, 'hex');
    const decipher = crypto.createDecipheriv(LEGACY_CBC_ALGO, key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  if (options.strict) {
    throw new Error('El valor proporcionado no tiene un formato cifrado válido.');
  }

  return cipherText;
}

function needsReencryption(value) {
  return Boolean(value && typeof value === 'string' && !isEncryptedV2(value));
}

function reencryptSecret(value, options = {}) {
  if (!value || typeof value !== 'string') return value;
  const plain = decryptText(value, options);
  return encryptText(plain, options);
}

module.exports = {
  encrypt: encryptText,
  decrypt: decryptText,
  encryptText,
  decryptText,
  encryptSecret: encryptText,
  decryptSecret: decryptText,
  needsReencryption,
  reencryptSecret,
  isEncrypted,
  isEncryptedV2,
  isConfigured,
  buildAadBuffer,
};
