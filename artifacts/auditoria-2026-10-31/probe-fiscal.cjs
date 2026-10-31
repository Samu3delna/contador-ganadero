// Diagnostic only: no .env, database, remote API, or application mutations.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const backend = path.resolve(__dirname, '../../backend');
const req = Module.createRequire(path.join(backend, 'package.json'));
function isolated(relative, stubs = {}) {
  const filename = path.join(backend, relative);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(stubs, id) ? stubs[id] : nativeRequire(id);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}
const results = {};
async function main() {
  const Tenant = req('./models/Tenant');
  const worker = req('./services/haciendaWorker');
  const tenant = new Tenant({_id:'000000000000000000000003', configuracionHacienda:{ambiente:'sandbox',certificadoP12Base64:'synthetic',pinCertificado:'synthetic',usuarioHacienda:'cpf-synthetic',passwordHacienda:'synthetic'}});
  const tenantCfg = worker.getTenantConfig(tenant);
  results.tenantCredentials = {configured:tenant.configuracionHacienda.estaConfigurado(),pin:tenantCfg.pin,password:tenantCfg.password,rootMethod:typeof tenant.obtenerPinCertificado,nestedMethod:typeof tenant.configuracionHacienda.obtenerPinCertificado};
  const forge = req('node-forge');
  const signer = req('./services/hacienda/signer');
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  cert.setSubject([{name: 'commonName', value: 'Audit synthetic only'}]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'synthetic-pin', {algorithm: '3des'});
  const b64 = forge.util.encode64(forge.asn1.toDer(p12).getBytes());
  try { signer.cargarLlaveDesdeBase64(b64, 'synthetic-pin', 'synthetic-only'); results.p12 = 'loaded'; }
  catch(e) { results.p12 = {error: e.message}; }
  const signed = signer.firmarXml('<FacturaElectronica><Clave>synthetic</Clave></FacturaElectronica>', {
    certPem: forge.pki.certificateToPem(cert), keyPem: forge.pki.privateKeyToPem(keys.privateKey),
  });
  results.signature = {hasSignature: signed.includes('ds:Signature'), hasSignedProperties: signed.includes('SignedProperties'), hasSignaturePolicy: signed.includes('SignaturePolicy')};

  const reception = isolated('services/hacienda/recepcion.js', {
    axios: {get: async () => ({status: 200, data: {'ind-estado': 'aceptado', 'respuesta-xml': 'PHgvPg==', fecha: '2026-10-31T12:00:00Z'}})},
    './auth': {getEndpoint: () => ({consulta: 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/'}), getToken: async () => ({access_token: 'synthetic'})},
  });
  results.poll = await reception.consultarEstado({ambiente: 'sandbox', clave: 'synthetic'});

  const Emission = req('./models/FacturaEmision');
  const doc = new Emission({tipoDocumento:'FE', consecutivo:'00100001010000000001', tipoProducto:'carne_bovino', usuario:'000000000000000000000001',
    emisor:{nombre:'Audit',cedula:{numero:'123456789'},provincia:'1'}, receptor:{nombre:'Audit2',cedula:{numero:'987654321'}},
    codigoActividadEmisor:'012345', lineaDetalle:[{numeroLinea:1,codigo:'0212010100100',descripcion:'Synthetic',cantidad:1,precioUnitario:1000,subtotal:1000,montoTotal:1010,descuento:{monto:100},impuesto:{tarifa:13}}]});
  const calc = Emission.schema.s.hooks._pres.get('save').find(h => h.fn.toString().includes('TARIFA_REA'));
  calc.fn.call(doc);
  results.emission = {line: doc.lineaDetalle[0].toObject(), summary: doc.resumenFactura.toObject(), persistedProvince: doc.toObject().emisor.provincia ?? null, persistedActivity: doc.toObject().codigoActividadEmisor ?? null};
  const te = new Emission({tipoDocumento:'TE',consecutivo:'00100001020000000001',tipoProducto:'carne_bovino',usuario:'000000000000000000000001',emisor:{nombre:'Audit',cedula:{numero:'123456789'}},lineaDetalle:[]});
  results.teWithoutReceiver = Object.keys(te.validateSync()?.errors || {});
  const Income = req('./models/Ingreso');
  const milk = Income.hydrate({_id:'000000000000000000000002',tenantId:'000000000000000000000003',usuario:'000000000000000000000001',fecha:new Date(),descripcion:'milk',categoriaIngreso:'venta_leche',litrosVendidos:10,precioUnitario:100,montoSubtotal:1000,tasaIVA:1,ivaVenta:10,montoTotal:1010});
  milk.litrosVendidos = 20;
  const incomeCalc = Income.schema.s.hooks._pres.get('validate').find(h => h.fn.toString().includes('litrosVendidos'));
  incomeCalc.fn.call(milk);
  results.milkEdit = {litros:milk.litrosVendidos, subtotal:milk.montoSubtotal, expectedSubtotal:2000};

  const invoice = {tipoDocumento:'Nota de Crédito',estado:'procesada',esDeducible:true,moneda:'USD',tipoCambio:500,tasaIVA:13,emisor:{cedula:{numero:'123456789'}},resumenFactura:{totalVenta:100,totalVentaNeta:100,totalImpuesto:13,totalComprobante:113},lineaDetalle:[{subtotal:100,impuesto:{tarifa:13,monto:13},impuestoNeto:0}]};
  const taxes = isolated('services/impuestoService.js', {'../models/Factura':{find:async()=>[invoice]},'../models/Ingreso':{find:async()=>[]},'../models/Usuario':{findById:async()=>({})}});
  results.taxCreditNoteUSD = await taxes.calcularIVACuatrimestral('synthetic',1,2026,'synthetic');
  const d150 = isolated('services/d150Service.js', {'../models/Factura':{find:()=>({lean:async()=>[invoice]})},'../models/Ingreso':{find:()=>({lean:async()=>[]})},'../models/FacturaEmision':{find:()=>({lean:async()=>[]})}});
  results.d150CreditNoteUSD = (await d150.generarConciliacion({usuarioId:'synthetic',tenantId:'synthetic',mes:1,anio:2026})).totales;

  let nvidiaInit = 0, nvidiaCalls = 0;
  const ai = isolated('services/aiProvider.js', {
    '../config/ai':{configurarIA:()=>({gemini:{apiKey:'synthetic',modelo:'synthetic'},nvidia:{apiKey:'synthetic',modelo:'synthetic'},defaults:{}})},
    '@google/genai':{GoogleGenAI:class {constructor(){this.models={generateContent:async()=>{throw new Error('synthetic Gemini failure')}};}},Type:{OBJECT:'OBJECT',STRING:'STRING',BOOLEAN:'BOOLEAN',NUMBER:'NUMBER'}},
    openai:class {constructor(){nvidiaInit++;this.chat={completions:{create:async()=>{nvidiaCalls++;return {choices:[{message:{content:'{}'}}]};}}};}},
  });
  const fallback = await ai.categorizarFacturaDual({lineaDetalle:[]},'synthetic');
  results.aiFallback = {nvidiaInit,nvidiaCalls,fallbackCategory:fallback.categoriaIA};
  const chain = data => ({sort(){return this},limit(){return this},lean:async()=>data});
  const chat = isolated('controllers/chatController.js', {
    '../models/Factura':{find:()=>chain([])},'../models/Ingreso':{find:()=>chain([{montoTotal:1010,descripcion:'milk'}])},
    '../models/Inventario':{findOne:()=>chain(null)},'../models/CostoProduccion':{find:()=>chain([])},'../utils/chatCache':{contextCache:new Map()},
  });
  const context = await chat.obtenerContextoUsuario('synthetic','synthetic');
  results.chat = {totalIncome:context.resumen.totalIngresos,lastIncome:context.ultimosIngresos};
  const exportsService = isolated('services/declaracionService.js');
  results.csv = exportsService.generarCSV([{tipo:'GASTO',proveedor:'=SUM(1,2)'}]);
  const keysService = req('./services/hacienda/clave50');
  results.key = keysService.generarClave({cedulaEmisor:'123456789',tipoDocumento:'FEC',codigoSeguridad:'987654321'});
  const builder = req('./services/hacienda/xmlBuilder');
  const xmlDoc = doc.toObject();
  xmlDoc.claveNumerica = '1'.repeat(50);
  const built = builder.buildXml(xmlDoc);
  results.builder = {namespace:builder.TIPO_DOC_CONFIG.FE.namespace,amountTag:built.match(/<MontoTotal>(.*?)<\/MontoTotal>/)?.[1],subtotalTag:built.match(/<SubTotal>(.*?)<\/SubTotal>/)?.[1],totalLineTag:built.match(/<MontoTotalLinea>(.*?)<\/MontoTotalLinea>/)?.[1],hasCabys:built.includes('<CodigoCABYS>')};
  const parser = req('./services/xmlParserService');
  const parsed = parser.parsearFacturaXML('<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"><Emisor><Nombre>Audit</Nombre></Emisor><DetalleServicio><LineaDetalle><Detalle>concentrado</Detalle><SubTotal>1000</SubTotal><Impuesto><Codigo>01</Codigo><CodigoTarifaIVA>02</CodigoTarifaIVA><Tarifa>1</Tarifa><Monto>10</Monto><Exoneracion><MontoExoneracion>10</MontoExoneracion></Exoneracion></Impuesto><ImpuestoNeto>0</ImpuestoNeto></LineaDetalle></DetalleServicio></FacturaElectronica>');
  results.parser = {parsedTax:parsed.lineaDetalle[0].impuesto,netTax:parsed.lineaDetalle[0].impuestoNeto,alerts:parsed.alertasTarifa};
  fs.writeFileSync(path.join(__dirname,'probe-fiscal-results.json'), JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
