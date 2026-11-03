const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const forge = require('node-forge');
const { facturaPrueba } = require('./fixtures.cjs');
const { cargarSdk } = require('../services/hacienda/sdkLoader');
const { generarClave, TIPO_DOC_CODIGO } = require('../services/hacienda/clave50');
const { buildXml, TIPO_DOC_CONFIG } = require('../services/hacienda/xmlBuilder');
const { firmarDocumento, validarCertificado } = require('../services/hacienda/signer');
const { getToken, limpiarCacheTokens } = require('../services/hacienda/auth');
const { enviarComprobante, consultarEstado } = require('../services/hacienda/recepcion');
const { obtenerConfiguracionSdk } = require('../services/hacienda/sdkAdapter');
const realFetch = global.fetch;
// Tests may only use this explicit fake transport. No fallthrough to a live request.
global.fetch = async () => { throw new Error('NETWORK_DISABLED_FOR_TESTS'); };
after(() => { global.fetch = realFetch; limpiarCacheTokens(); });

test('claves oficiales preservan fecha CR, tipo, consecutivo y 8 dígitos de seguridad', async () => {
  for (const [tipoDocumento,codigo] of Object.entries(TIPO_DOC_CODIGO)) {
    const result = await generarClave({ tipoDocumento, cedulaEmisor: '123456789', fecha: new Date('2026-11-01T02:00:00Z'), codigoSeguridad: '12345678' });
    assert.match(result.clave, /^\d{50}$/);
    assert.equal(result.clave.slice(3,9), '311026');
    assert.equal(result.clave.slice(21,41), result.consecutivo);
    assert.equal(result.consecutivo.slice(8,10), codigo);
    assert.equal(result.clave.slice(41), '112345678');
  }
});
for (const tipo of Object.keys(TIPO_DOC_CONFIG)) {
  test(`${tipo}: modelo a XML válido por XSD del SDK`, async () => {
    const factura = await facturaPrueba(tipo);
    const xml = await buildXml(factura.toObject());
    assert.ok(xml.includes(`<${TIPO_DOC_CONFIG[tipo].rootElement}`));
    assert.ok(xml.includes(TIPO_DOC_CONFIG[tipo].namespace));
    if (tipo === 'TE') assert.ok(!xml.includes('<Receptor>'));
    if (tipo === 'REP') assert.ok(!xml.includes('<MensajeReceptor>'));
  });
}
for (const [codigoTarifa,tarifa] of [['09',0.5],['02',1],['03',2],['08',13]]) {
  test(`IVA ${tarifa}%: descuento antes de IVA, factor cliente ignorado y XSD válido`, async () => {
    const factura = await facturaPrueba('FE', { lineaDetalle: [{numeroLinea:1,codigo:'0212010100100',descripcion:'Leche',cantidad:2,precioUnitario:5000,descuento:{monto:1000,codigoDescuento:'07',naturalezaDescuento:'Comercial'},impuesto:{codigo:'01',codigoTarifa,tarifa,factorIVA:99,monto:999999}}], tipoProducto:'leche' });
    assert.equal(factura.lineaDetalle[0].subtotal,9000);
    assert.equal(factura.lineaDetalle[0].impuesto.monto,9000*tarifa/100);
    assert.equal(factura.resumenFactura.totalVenta,10000);
    assert.equal(factura.resumenFactura.totalMercanciasGravadas,10000);
    assert.equal(factura.resumenFactura.totalServGravados,0);
    assert.equal(factura.resumenFactura.totalComprobante,9000+9000*tarifa/100);
    await buildXml(factura.toObject());
  });
}
test('montos manipulados, tarifa contradictoria y ubicación incompleta se rechazan', async () => {
  const factura = await facturaPrueba();
  const input = factura.toObject(); input.lineaDetalle[0].impuesto.monto=0;
  await assert.rejects(buildXml(input),/impuesto.monto/);
  await assert.rejects(facturaPrueba('FE',{lineaDetalle:[{numeroLinea:1,codigo:'0212010100100',descripcion:'Prueba',cantidad:1,precioUnitario:10,impuesto:{codigo:'01',codigoTarifa:'02',tarifa:13}}]}),/tarifa/i);
  const incomplete=factura.toObject(); delete incomplete.emisor.provincia;
  await assert.rejects(buildXml(incomplete),/provincia/);
});

test('firma XAdES real con P12 efímero: política, digest, certificado y RSA verifican', async () => {
  const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
  const key=forge.pki.privateKeyFromPem(pair.privateKey);
  const cert=forge.pki.createCertificate(); cert.publicKey=forge.pki.publicKeyFromPem(pair.publicKey);cert.serialNumber='01';
  cert.validity.notBefore=new Date(Date.now()-86400000);cert.validity.notAfter=new Date(Date.now()+86400000);
  cert.setSubject([{name:'commonName',value:'TEST ONLY'},{name:'serialNumber',value:'CPF-123456789'}]);cert.setIssuer(cert.subject.attributes);
  cert.sign(key,forge.md.sha256.create());
  const der=forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(key,[cert],'test-pin',{algorithm:'3des'})).getBytes();
  const p12Base64=Buffer.from(der,'binary').toString('base64');
  const cfg={p12Base64,pin:'test-pin',ambiente:'sandbox',cacheKey:'tenant-test'};
  const metadata=await validarCertificado(cfg); assert.ok(metadata.fingerprint); assert.ok(!JSON.stringify(metadata).includes(p12Base64));
  const f=await facturaPrueba();const xml=await buildXml(f.toObject());const signed=await firmarDocumento(xml,cfg);
  assert.match(signed,/SignaturePolicyIdentifier/); assert.match(signed,/SignedProperties/);
  const sdk=await cargarSdk();const verification=await sdk.verifySignedDocumentXml(signed,{trustedSignerCertificates:[forge.pki.certificateToPem(cert)]});
  assert.equal(verification.valid,true,JSON.stringify(verification.errors));
  assert.equal((await sdk.validateDocumentXml(signed,{requireSignature:true})).valid,true);
  await assert.rejects(validarCertificado({...cfg,pin:'wrong'}));
  const modified=signed.replace('Producto sintético','Documento alterado');
  assert.equal((await sdk.verifySignedDocumentXml(modified,{trustedSignerCertificates:[forge.pki.certificateToPem(cert)]})).valid,false);
});

test('transporte SDK: tenants aislados, rotación, URL sandbox, estados y POST sin replay', async () => {
  limpiarCacheTokens(); const calls=[]; let postStatus=201;let status='aceptado';let uncertain=false;
  global.fetch=async(url,options={})=>{
    calls.push({url:String(url),method:options.method||'GET',body:options.body,headers:options.headers});
    if(String(url).includes('/token'))return new Response(JSON.stringify({access_token:'synthetic-token-'+calls.length,refresh_token:'synthetic-refresh',expires_in:300,refresh_expires_in:600,token_type:'Bearer'}),{status:200,headers:{'content-type':'application/json'}});
    if(options.method==='POST'){
      if(uncertain)throw new Error('simulated timeout');
      return new Response(postStatus===201?null:JSON.stringify({error:'synthetic'}),{status:postStatus,headers:{'content-type':'application/json',location:'https://attacker.example/steal'}});
    }
    return new Response(JSON.stringify({clave,fecha:new Date().toISOString(),'ind-estado':status,'respuesta-xml':Buffer.from('<MensajeHacienda><DetalleMensaje>Prueba</DetalleMensaje></MensajeHacienda>').toString('base64')}),{status:200,headers:{'content-type':'application/json'}});
  };
  const creds={ambiente:'sandbox',tenantId:'tenant-a',usuario:'cpf-test',password:'synthetic-secret'};
  const {clave}=await generarClave({cedulaEmisor:'123456789'});
  const documento={clave,fecha:new Date().toISOString(),emisorTipoId:'01',emisorNumeroId:'123456789',xmlFirmado:'<xml>synthetic signed content</xml>'};
  try {
    await getToken(creds);await getToken(creds);await getToken({...creds,tenantId:'tenant-b'});await getToken({...creds,password:'rotated'});
    assert.equal(calls.filter(c=>c.url.includes('/token')).length,3);
    await assert.rejects(getToken({...creds,tenantId:undefined}),/tenantId/);
    const config=await obtenerConfiguracionSdk('sandbox');assert.equal(config.apiBaseUrl,'https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1');
    const cfg={ambiente:'sandbox',credenciales:creds,documento};
    const response=await enviarComprobante(cfg);assert.equal(response.httpStatus,201);assert.ok(!response.location.includes('attacker'));
    assert.ok(calls.filter(c=>c.method==='POST'&&!c.url.includes('/token')).every(c=>c.url.startsWith(config.apiBaseUrl)));
    const result=await consultarEstado({...cfg,clave,location:'http://127.0.0.1/secret'});assert.equal(result.estado,'aceptado');assert.match(result.xmlRespuesta,/Prueba/);
    status='rechazado';assert.equal((await consultarEstado({...cfg,clave})).estado,'rechazado');
    status='error';assert.equal((await consultarEstado({...cfg,clave})).estado,'procesando');
    for(const code of [400,401,403,409,429,500]) {
      postStatus=code; const before=calls.filter(c=>c.method==='POST'&&!c.url.includes('/token')).length;
      const failed=await enviarComprobante(cfg);assert.equal(failed.errorSinRechazo,true);assert.equal(failed.retry,false);
      assert.equal(calls.filter(c=>c.method==='POST'&&!c.url.includes('/token')).length,before+1);
    }
    uncertain=true;const resultTimeout=await enviarComprobante(cfg);assert.equal(resultTimeout.consultaRequerida,true);
    await assert.rejects(enviarComprobante({...cfg,documento:{...documento,xmlFirmado:'<MockSig>MOCK_LOCAL</MockSig>'}}),/simulada/);
  } finally { limpiarCacheTokens();global.fetch=async()=>{throw new Error('NETWORK_DISABLED_FOR_TESTS');}; }
});

test('NC puede referenciar un tiquete sin receptor identificado',async()=>{
 const factura=await facturaPrueba('NC',{receptor:undefined});
 const xml=await buildXml(factura.toObject());assert.ok(!xml.includes('<Receptor>'));
});
