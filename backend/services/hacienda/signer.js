/** XAdES-EPES through the pinned Hacienda SDK. Private keys are not cached. */
const fs = require('node:fs/promises');
const { X509Certificate } = require('node:crypto');
const { XMLValidator } = require('fast-xml-parser');
const { cargarSdk } = require('./sdkLoader');
const MAX_P12_BYTES = 1024 * 1024;

async function leerP12({ p12Base64, p12Path, cacheKey } = {}) {
  let buffer;
  if (p12Base64) {
    const encoded = String(p12Base64).replace(/^data:[^,]*;base64,/i, '').replace(/\s/g, '');
    if (encoded.length > Math.ceil(MAX_P12_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new Error('Certificado .p12 inválido o mayor de 1 MiB');
    }
    buffer = Buffer.from(encoded, 'base64');
    if (buffer.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
      throw new Error('El certificado .p12 no contiene Base64 válido');
    }
  } else if (p12Path && (!cacheKey || cacheKey === 'global')) {
    // Only explicit legacy global configuration may read a server-side path.
    const stat = await fs.stat(p12Path);
    if (!stat.isFile() || stat.size > MAX_P12_BYTES) throw new Error('Certificado .p12 inválido o mayor de 1 MiB');
    buffer = await fs.readFile(p12Path);
  } else {
    throw new Error('No hay certificado .p12 configurado para esta finca');
  }
  if (!buffer.length || buffer.length > MAX_P12_BYTES) throw new Error('Certificado .p12 inválido o mayor de 1 MiB');
  return buffer;
}

function validarPin(pin) {
  if (typeof pin !== 'string' || !pin) throw new Error('PIN del certificado obligatorio');
}

async function validarCertificado(config = {}) {
  validarPin(config.pin);
  const p12 = await leerP12(config);
  try {
    const { loadP12 } = await cargarSdk();
    const credentials = await loadP12(p12, config.pin);
    const certificate = new X509Certificate(credentials.certificatePem);
    return { fingerprint: certificate.fingerprint256, subject: certificate.subject,
      issuer: certificate.issuer, validFrom: certificate.validFrom, validTo: certificate.validTo };
  } finally { p12.fill(0); }
}

async function firmarDocumento(xmlString, config = {}) {
  if (!['local', 'sandbox', 'produccion'].includes(config.ambiente)) throw new Error('Ambiente de Hacienda inválido');
  if (typeof xmlString !== 'string' || Buffer.byteLength(xmlString, 'utf8') > 4 * 1024 * 1024 ||
      XMLValidator.validate(xmlString) !== true || /<!DOCTYPE|<!ENTITY/i.test(xmlString)) {
    throw new Error('XML inválido para firmar');
  }
  if (/<(?:[\w.-]+:)?Signature(?:\s|>)/.test(xmlString)) throw new Error('El XML ya contiene una firma');
  if (config.ambiente === 'local') {
    const close = xmlString.match(/<\/([A-Za-z_][\w.:-]*)>\s*$/);
    if (!close) throw new Error('No se encontró el nodo raíz del XML');
    return xmlString.replace(close[0],
      `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="MockSig"><ds:SignatureValue>MOCK_LOCAL_AMBIENTE_NO_ENVIAR_A_PRODUCCION</ds:SignatureValue></ds:Signature>${close[0]}`);
  }
  validarPin(config.pin);
  const p12 = await leerP12(config);
  try {
    const { signXml } = await cargarSdk();
    return await signXml(xmlString, p12, config.pin);
  } finally { p12.fill(0); }
}

// Kept for rotation callers; no decrypted key survives a call.
function limpiarCacheLlave() {}

module.exports = { firmarDocumento, validarCertificado, limpiarCacheLlave };
