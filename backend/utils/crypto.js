const crypto = require('crypto');

const ENC_KEY = process.env.EMAIL_ENC_KEY;

if (!ENC_KEY) {
  console.warn('⚠️  EMAIL_ENC_KEY no configurada. Los passwords de configEmail NO serán encriptados.');
} else if (ENC_KEY.length !== 64) {
  console.warn('⚠️  EMAIL_ENC_KEY debe tener exactamente 64 caracteres hex (32 bytes). Los passwords de configEmail NO serán encriptados.');
}

const isKeyValid = ENC_KEY && ENC_KEY.length === 64;

// AES-256-CBC encryption: returns "iv:ciphertext" base64 encoded
const encrypt = (text) => {
  if (!text) return text;
  if (!isKeyValid) return text; // fallback: store as-is if no key configured or invalid length
  const key = Buffer.from(ENC_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
};

// Decrypt from "iv:ciphertext" format
const decrypt = (encrypted) => {
  if (!encrypted || !encrypted.includes(':')) return encrypted;
  if (!isKeyValid) return encrypted;
  const [ivBase64, encryptedBase64] = encrypted.split(':');
  const key = Buffer.from(ENC_KEY, 'hex');
  const iv = Buffer.from(ivBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = { encrypt, decrypt };
