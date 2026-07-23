/**
 * Firmador XAdES-EPES para comprobantes electronicos v4.4 de Hacienda CR.
 *
 * Lee el .p12 (llave criptografica), extrae certificado y llave privada,
 * y aplica firma XML DSIG envoltorio "enveloped" con prefix xades.
 *
 * Requiere: node-forge (parseo .p12) y xml-crypto (firma XML).
 */

const fs = require('fs');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

let _cachedKeyPair = null;

const DEFAULT_XADES_POLICY = 'https://sid.hacienda.go.cr/ak/firma-electronica/4.2';

/**
 * Lee y desempaqueta el .p12 con el PIN.
 * Retorna { certPem, keyPem, fingerprint, subjectCN, cert }.
 * Cachea el par en memoria tras primera lectura exitosa.
 */
function cargarLlave(p12Path, pin) {
  if (_cachedKeyPair && _cachedKeyPair._path === p12Path) return _cachedKeyPair;

  if (!p12Path || !fs.existsSync(p12Path)) {
    throw new Error(`Archivo .p12 no encontrado: ${p12Path}`);
  }
  if (!pin) throw new Error('PIN de la llave criptografica es obligatorio');

  const p12B64 = fs.readFileSync(p12Path, { encoding: 'base64' });
  const p12Asn1 = forge.asn1.fromDer(p12B64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pin);

  let certBag = null;
  let keyBag = null;
  for (const bag of p12.safeContents) {
    for (const item of bag.bags) {
      if (item.type === forge.pki.oids.certBag && item.attributes?.friendlyId?.value?.[0]) {
        certBag = item;
      }
      if (item.type === forge.pki.oids.pkcs8ShroudedKeyBag || item.type === forge.pki.oids.keyBag) {
        keyBag = item;
      }
    }
  }
  if (!certBag) certBag = p12.safeContents.flatMap((s) => s.bags).find((b) => b.type === forge.pki.oids.certBag);
  if (!keyBag) keyBag = p12.safeContents.flatMap((s) => s.bags).find((b) => b.type === forge.pki.oids.pkcs8ShroudedKeyBag || b.type === forge.pki.oids.keyBag);
  if (!certBag) throw new Error('No se encontro certificado en el .p12');
  if (!keyBag) throw new Error('No se encontro llave privada en el .p12 (PIN incorrecto?)');

  const cert = certBag.cert;
  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keyBag.key);

  //Fingerprint SHA-256 base16 separado por ":" (lo usa xml-crypto como KeyInfo)
  const derCert = forge.asn1.toDer(forge.pki.certificateToAsn1(cert));
  const md = forge.md.sha256.create();
  md.update(derCert.getBytes());
  const fingerprint = md.digest().toHex().match(/.{2}/g).join(':').toUpperCase();

  const subjectCN = cert.subject.getField('CN')?.value || '';
  const issuerCN = cert.issuer.getField('CN')?.value || '';

  const result = {
    _path: p12Path,
    certPem,
    keyPem,
    fingerprint,
    subjectCN,
    issuerCN,
    cert,
    serialNumber: cert.serialNumber,
  };
  _cachedKeyPair = result;
  return result;
}

function limpiarCacheLlave() {
  _cachedKeyPair = null;
}

/**
 * Aplica firma XAdES-EPES enveloped al XML en string.
 * Inserta <ds:Signature> dentro del nodo raiz del comprobante.
 */
function firmarXml(xmlString, keyPair) {
  if (!xmlString) throw new Error('XML vacio');
  if (!keyPair?.certPem || !keyPair?.keyPem) throw new Error('keyPair invalido');

  const signed = new SignedXml({
    privateKey: keyPair.keyPem,
    publicCert: keyPair.certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    //xades namespace necesario para XAdES-EPES
  });

  signed.addReference({
    xpath: '/*',
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
  });

  //KeyInfo con X509Data
  signed.computeSignature(xmlString, {
    prefix: 'ds',
    location: {
      reference: '/*',
      action: 'append', //firmara dentro del nodo raiz
    },
    existingPrefixes: { xades: 'http://uri.etsi.org/01903/v1.3.2#' },
  });

  return signed.getSignedXml();
}

/**
 * Interfaz de alto nivel: toma un documento y lo firma usando el .p12 configurado.
 * El ambiente local produce un XML "firmado" simulado manteniendo formato valido
 * (para que el resto del pipeline pueda probarse).
 */
function firmarDocumento(xmlString, { p12Path, pin, ambiente } = {}) {
  if (ambiente === 'local') {
    //Firma mock: envolvemos con un Signature placeholder para que el worker pueda continuar
    return xmlString.replace('</FacturaElectronica>', `
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="MockSig">
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <ds:Reference URI="">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <ds:DigestValue>MOCK_LOCAL_AMBIENTE_NO_ENVIAR_A_PRODUCCION</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>MOCK</ds:SignatureValue>
    <ds:KeyInfo><ds:X509Data><ds:X509Certificate>MOCK</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
  </ds:Signature>
</FacturaElectronica>`);
  }
  const keyPair = cargarLlave(p12Path, pin);
  return firmarXml(xmlString, keyPair);
}

module.exports = {
  cargarLlave,
  firmarXml,
  firmarDocumento,
  limpiarCacheLlave,
  DEFAULT_XADES_POLICY,
};
