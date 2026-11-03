const mongoose = require('mongoose');
const Factura = require('../models/FacturaEmision');
const { generarClave } = require('../services/hacienda/clave50');

async function facturaPrueba(tipoDocumento = 'FE', cambios = {}) {
  const fechaEmision = new Date('2026-11-01T12:00:00.000Z');
  const emisor = { nombre: 'Finca de prueba', cedula: { tipo: '01', numero: '123456789' }, correo: 'finca@example.test', provincia: '1', canton: '01', distrito: '01', ubicacion: 'Dirección sintética de pruebas' };
  const receptor = { ...emisor, nombre: 'Cliente de prueba', cedula: { tipo: '02', numero: '3101234567' } };
  const { clave, consecutivo } = await generarClave({ fecha: fechaEmision, tipoDocumento, cedulaEmisor: '123456789', codigoSeguridad: '12345678' });
  const factura = new Factura({
    tipoDocumento, claveNumerica: clave, consecutivo, fechaEmision, ambiente: 'local',
    proveedorSistemas: '3101999999', codigoActividadEmisor: '014101', codigoActividadReceptor: '014101',
    emisor: tipoDocumento === 'FEC' ? receptor : emisor,
    receptor: tipoDocumento === 'TE' ? undefined : tipoDocumento === 'FEC' ? emisor : receptor,
    usuario: new mongoose.Types.ObjectId(), tipoProducto: 'carne_bovino', condicionVenta: tipoDocumento === 'REP' ? '11' : '01', medioPago: ['04'],
    lineaDetalle: [{ numeroLinea: 1, codigo: '0212010100100', descripcion: 'Producto sintético', cantidad: 2, precioUnitario: 5000, unidadMedida: 'Kg', impuesto: { codigo: '01', codigoTarifa: '02', tarifa: 1 } }],
    documentoReferencia: ['FE', 'TE'].includes(tipoDocumento) ? undefined : { tipoDocReferencia: '01', numeroReferencia: clave, fechaEmisionReferencia: fechaEmision, codigoReferencia: tipoDocumento === 'REP' ? '17' : '01', razonReferencia: 'Documento sintético' },
    ...cambios,
  });
  await factura.validate();
  return factura;
}
module.exports = { facturaPrueba };

function certificadoPrueba() {
 const forge=require('node-forge');const {generateKeyPairSync}=require('node:crypto');
 const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const key=forge.pki.privateKeyFromPem(pair.privateKey);const cert=forge.pki.createCertificate();cert.publicKey=forge.pki.publicKeyFromPem(pair.publicKey);cert.serialNumber='02';
 cert.validity.notBefore=new Date(Date.now()-86400000);cert.validity.notAfter=new Date(Date.now()+86400000);cert.setSubject([{name:'commonName',value:'TEST ONLY'}]);cert.setIssuer(cert.subject.attributes);cert.sign(key,forge.md.sha256.create());
 const der=forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(key,[cert],'synthetic-pin',{algorithm:'3des'})).getBytes();
 return Buffer.from(der,'binary').toString('base64');
}
module.exports.certificadoPrueba=certificadoPrueba;
