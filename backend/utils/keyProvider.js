/**
 * Proveedor de Claves (KeyProvider) con soporte de rotación de KEK (Key Encryption Key)
 * y Envelope Encryption (DEK por organización cifrada con la KEK maestra).
 *
 * Prepara la arquitectura para sustituir la lectura de variables de entorno por
 * AWS KMS, Google Cloud KMS o HashiCorp Vault sin cambiar los modelos ni controladores.
 */

const crypto = require('crypto');

const GCM_ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado por NIST SP 800-38D para GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Construye el mapa de KEKs disponibles a partir del entorno:
 * - MASTER_KEK_ID (por defecto 'k1')
 * - MASTER_KEK_CURRENT (o EMAIL_ENC_KEY como fallback de 64 hex)
 * - MASTER_KEK_PREVIOUS (formato 'k0:64hex,k_old:64hex')
 */
function cargarMapaKeks() {
  const activeId = (process.env.MASTER_KEK_ID || 'k1').trim();
  const currentHex = (process.env.MASTER_KEK_CURRENT || process.env.EMAIL_ENC_KEY || '').trim();
  const map = new Map();

  if (/^[0-9a-fA-F]{64}$/.test(currentHex)) {
    map.set(activeId, Buffer.from(currentHex, 'hex'));
    if (activeId !== 'k1') {
      map.set('k1', Buffer.from(currentHex, 'hex'));
    }
  }

  const prevRaw = (process.env.MASTER_KEK_PREVIOUS || '').trim();
  if (prevRaw) {
    for (const pair of prevRaw.split(',')) {
      const [id, hex] = pair.split(':').map((s) => (s || '').trim());
      if (id && /^[0-9a-fA-F]{64}$/.test(hex)) {
        map.set(id, Buffer.from(hex, 'hex'));
      }
    }
  }

  return { activeId, map };
}

class KeyProvider {
  /**
   * Obtiene la KEK activa para cifrar o envolver DEKs.
   * @returns {{ keyId: string, keyBuffer: Buffer }}
   */
  static getActiveKek() {
    const { activeId, map } = cargarMapaKeks();
    const keyBuffer = map.get(activeId);
    if (!keyBuffer || keyBuffer.length !== 32) {
      throw new Error('No hay una clave maestra (MASTER_KEK_CURRENT / EMAIL_ENC_KEY) válida de 64 caracteres hex.');
    }
    return { keyId: activeId, keyBuffer };
  }

  /**
   * Obtiene una KEK por su identificador de versión (permite descifrar datos antiguos tras rotar).
   * @param {string} keyId
   * @returns {Buffer}
   */
  static getKekById(keyId) {
    const { activeId, map } = cargarMapaKeks();
    const keyBuffer = map.get(keyId) || map.get(activeId);
    if (!keyBuffer || keyBuffer.length !== 32) {
      throw new Error(`Clave KEK no encontrada para keyId="${keyId}".`);
    }
    return keyBuffer;
  }

  /**
   * Genera una nueva DEK (Data Encryption Key) aleatoria de 32 bytes para un Tenant
   * y devuelve tanto la DEK en memoria como su versión envuelta (encryptedDek).
   * @param {string} tenantId
   * @returns {{ dekBuffer: Buffer, encryptedDek: string }}
   */
  static generateTenantDek(tenantId) {
    const dekBuffer = crypto.randomBytes(32);
    const encryptedDek = this.wrapDek(dekBuffer, tenantId);
    return { dekBuffer, encryptedDek };
  }

  /**
   * Envuelve (cifra) una DEK de 32 bytes bajo la KEK activa usando AES-256-GCM y AAD del tenant.
   * @param {Buffer} dekBuffer
   * @param {string} tenantId
   * @returns {string} Formato: dek:v1:<keyId>:<ivB64>:<tagB64>:<cipherB64>
   */
  static wrapDek(dekBuffer, tenantId) {
    if (!Buffer.isBuffer(dekBuffer) || dekBuffer.length !== 32) {
      throw new Error('DEK inválida: debe ser un Buffer de 32 bytes.');
    }
    const { keyId, keyBuffer } = this.getActiveKek();
    const iv = crypto.randomBytes(IV_LENGTH);
    const aad = Buffer.from(`tenant-dek:${String(tenantId || 'global')}`, 'utf8');

    const cipher = crypto.createCipheriv(GCM_ALGO, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(dekBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `dek:v1:${keyId}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  /**
   * Desenvuelve (descifra) la DEK de un Tenant verificando autenticidad e integridad del AAD.
   * @param {string} encryptedDek
   * @param {string} tenantId
   * @returns {Buffer}
   */
  static unwrapDek(encryptedDek, tenantId) {
    if (!encryptedDek || typeof encryptedDek !== 'string' || !encryptedDek.startsWith('dek:v1:')) {
      throw new Error('Formato de encryptedDek inválido.');
    }
    const parts = encryptedDek.split(':');
    if (parts.length !== 6) {
      throw new Error('Estructura de encryptedDek corrupta.');
    }
    const [, , keyId, ivB64, tagB64, cipherB64] = parts;
    const kekBuffer = this.getKekById(keyId);
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');

    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Longitud de IV o AuthTag inválida en encryptedDek.');
    }

    const aad = Buffer.from(`tenant-dek:${String(tenantId || 'global')}`, 'utf8');
    const decipher = crypto.createDecipheriv(GCM_ALGO, kekBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}

module.exports = {
  KeyProvider,
  GCM_ALGO,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
};
