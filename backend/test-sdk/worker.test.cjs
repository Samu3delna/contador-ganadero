const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.EMAIL_ENC_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const mongoose=require('mongoose');
const {MongoMemoryServer}=require('mongodb-memory-server');
const Tenant=require('../models/Tenant');
const Factura=require('../models/FacturaEmision');
const { facturaPrueba }=require('./fixtures.cjs');
const worker=require('../services/haciendaWorker');
const {limpiarCacheTokens}=require('../services/hacienda/auth');
const recepcion=require('../services/hacienda/recepcion');
const signer=require('../services/hacienda/signer');
const {runWithTenantContext}=require('../utils/tenantContext');
const originalFetch=global.fetch;
let mongo;
global.fetch=async()=>{throw new Error('NETWORK_DISABLED_FOR_TESTS');};
before(async()=>{mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());await Factura.init();}, {timeout:60000});
afterEach(async()=>{limpiarCacheTokens();await Factura.deleteMany({}, {skipTenant:true});await Tenant.deleteMany({});});
after(async()=>{global.fetch=originalFetch;worker.detener();await mongoose.disconnect();await mongo?.stop();});
async function tenantPrueba(ambiente='local') {
 const tenant=await Tenant.crearParaUsuario({nombreFinca:'Finca sintética',owner:new mongoose.Types.ObjectId()});
 Object.assign(tenant.configuracionHacienda,{ambiente,codigoActividad:'014101',proveedorSistemas:'3101999999'});
 if(ambiente!=='local'){
  tenant.configuracionHacienda.usuarioHacienda='cpf-test';
  tenant.configuracionHacienda.establecerPasswordHacienda('synthetic-password');
  tenant.configuracionHacienda.establecerPinCertificado('synthetic-pin');
  tenant.configuracionHacienda.establecerCertificadoP12('synthetic-p12-for-mocked-transport');
 }
 await tenant.save(); return tenant;
}
async function documento(tenant,estado='firmada',extra={}) {
 const f=await facturaPrueba('FE',{tenantId:tenant._id,ambiente:tenant.configuracionHacienda.ambiente,estado,motorHacienda:worker.MOTOR_HACIENDA,...extra});
 if(estado!=='borrador')f.xmlFirmado='<FacturaElectronica>synthetic transport fixture</FacturaElectronica>';
 await f.save();return f;
}
function setupTransport({postFails=false,status='aceptado'}={}) {
 const calls=[];
 global.fetch=async(url,opt={})=>{
  calls.push({url:String(url),method:opt.method});
  if(String(url).includes('/token'))return new Response(JSON.stringify({access_token:'synthetic',refresh_token:'synthetic-refresh',expires_in:300,refresh_expires_in:600,token_type:'Bearer'}),{status:200,headers:{'content-type':'application/json'}});
  if(opt.method==='POST') {if(postFails)throw new Error('connection lost');return new Response(null,{status:201});}
  const clave=String(url).split('/').pop();
  return new Response(JSON.stringify({clave,'ind-estado':status,'respuesta-xml':Buffer.from('<MensajeHacienda><DetalleMensaje>Prueba</DetalleMensaje></MensajeHacienda>').toString('base64')}),{status:200,headers:{'content-type':'application/json'}});
 };return calls;
}
test('consecutivos MongoDB atómicos no colisionan y no usan fallback 1 al perder tenant',async()=>{
 const t=await tenantPrueba(); const numeros=await Promise.all(Array.from({length:20},()=>t.siguienteConsecutivo('FE')));
 assert.equal(new Set(numeros).size,20); assert.equal(Math.max(...numeros),20);
 await assert.rejects(t.siguienteConsecutivo('INVALID'),/inválido/);
 await Tenant.deleteOne({_id:t._id});await assert.rejects(t.siguienteConsecutivo('FE'),/No se pudo/);
});
test('cifrado fiscal queda vinculado a tenant y campo, getter correcto y sin fallback global',async()=>{
 const a=await tenantPrueba('sandbox');const b=await tenantPrueba();
 const cfg=worker.getTenantConfig(a);assert.equal(cfg.pin,'synthetic-pin');assert.equal(cfg.password,'synthetic-password');assert.equal(cfg.p12Base64,'synthetic-p12-for-mocked-transport');
 assert.match(a.configuracionHacienda.pinCertificado,/^v2:/);
 b.configuracionHacienda.ambiente='sandbox';b.configuracionHacienda.pinCertificado=a.configuracionHacienda.pinCertificado;
 assert.throws(()=>b.configuracionHacienda.obtenerPinCertificado());
 assert.throws(()=>worker.validarConfigDocumento(a,{ambiente:'produccion'}),/ambiente/);
 assert.equal(worker.getGlobalConfig().password,undefined);
});
test('ciclo local: borrador, firma SDK y polling; claves y XML se conservan',async()=>{
 const t=await tenantPrueba(); const f=await documento(t,'borrador');
 const firmada=await worker.prepararYFirmar(f._id);assert.equal(firmada.estado,'firmada');
 const signed=await Factura.findById(f._id).select('+xmlFirmado');assert.match(signed.xmlFirmado,/MockSig/);assert.equal(signed.motorHacienda,worker.MOTOR_HACIENDA);
 const same=await worker.prepararYFirmar(f._id);assert.equal(same.claveNumerica,signed.claveNumerica);
 await worker.enviarPendientes();assert.equal((await Factura.findById(f._id)).estado,'procesando');
 const store=require('../services/hacienda/mockStore');store.update(signed.claveNumerica,{aceptadoDesde:Date.now()-1});
 await worker.consultarProcesando();assert.equal((await Factura.findById(f._id)).estado,'aceptada');
});
test('dos instancias del worker compiten por el mismo claim y solo hacen un POST',async()=>{
 const t=await tenantPrueba('sandbox');const f=await documento(t);const calls=setupTransport();
 delete require.cache[require.resolve('../services/haciendaWorker')];const second=require('../services/haciendaWorker');
 await Promise.all([worker.enviarPendientes(),second.enviarPendientes()]);
 assert.equal(calls.filter(c=>c.method==='POST'&&!c.url.includes('/token')).length,1);
 assert.equal((await Factura.findById(f._id)).estado,'procesando');
 await worker.consultarProcesando();const terminal=await Factura.findById(f._id).select('+xmlRespuestaHacienda');assert.equal(terminal.estado,'aceptada');assert.match(terminal.xmlRespuestaHacienda,/MensajeHacienda/);
});
test('POST incierto persiste intento y tras reinicio consulta la misma clave sin volver a enviar',async()=>{
 const t=await tenantPrueba('sandbox');const f=await documento(t);const calls=setupTransport({postFails:true});
 await worker.enviarPendientes();const uncertain=await Factura.findById(f._id);assert.equal(uncertain.estado,'enviada_hacienda');assert.ok(uncertain.envioIntentadoEn);assert.ok(uncertain.erroresValidacion.length);
 delete require.cache[require.resolve('../services/haciendaWorker')];const second=require('../services/haciendaWorker');
 await second.tick();assert.equal(calls.filter(c=>c.method==='POST'&&!c.url.includes('/token')).length,1);
 assert.equal((await Factura.findById(f._id)).estado,'aceptada');
});
test('firma antigua o cambio de ambiente nunca dispara envío',async()=>{
 const t=await tenantPrueba('sandbox');const f=await documento(t,'firmada',{motorHacienda:undefined});const calls=setupTransport();
 await worker.enviarPendientes();assert.equal(calls.length,0);assert.equal((await Factura.findById(f._id)).estado,'firmada');
 f.motorHacienda=worker.MOTOR_HACIENDA;f.ambiente='produccion';await f.save();await worker.enviarPendientes();assert.equal(calls.length,0);
});
test('otra finca no puede firmar el documento fuera de su contexto',async()=>{
 const a=await tenantPrueba();const b=await tenantPrueba();const f=await documento(a,'borrador');
 await assert.rejects(runWithTenantContext({tenantId:String(b._id)},()=>worker.prepararYFirmar(f._id)),/no encontrada/);
});
test('REP real se bloquea aunque un cliente intente saltarse la ruta dedicada',async()=>{
 const t=await tenantPrueba('sandbox');const f=await facturaPrueba('REP',{tenantId:t._id,ambiente:'sandbox'});await f.save();
 await assert.rejects(worker.prepararYFirmar(f._id),/Comprobante histórico de solo lectura/);
});
test('eliminar credenciales preserva contador y no permite borrar con envío pendiente',async()=>{
 const controller=require('../controllers/haciendaConfigController');const t=await tenantPrueba();await t.siguienteConsecutivo('FE');
 let error;const req={tenant:{_id:t._id}};const res={json:()=>{}};
 await controller.eliminarConfig(req,res,e=>{error=e;});assert.equal(error,undefined);
 const fresh=await Tenant.findById(t._id);assert.equal(await fresh.siguienteConsecutivo('FE'),2);
 await documento(fresh);await controller.eliminarConfig(req,res,e=>{error=e;});assert.match(error.message,/pendientes/);
});

test('API local: configura finca, crea FE y TE, firma, conserva XML y bloquea consulta de borrador',async()=>{
 process.env.JWT_SECRET='synthetic-jwt-secret-32chars-for-sdk-tests';process.env.JWT_REFRESH_SECRET='synthetic-refresh-secret-32chars-for-sdk';
 const app=require('../server');const request=require('supertest');const jwt=require('jsonwebtoken');const Usuario=require('../models/Usuario');
 const user=await Usuario.create({nombre:'Owner SDK',email:`sdk-${new mongoose.Types.ObjectId()}@example.test`,password:'SyntheticPassword123!',cedula:'123456789',rol:'owner'});
 const t=await Tenant.crearParaUsuario({nombreFinca:'Finca SDK',owner:user._id,plan:'pro'});user.tenantId=t._id;await user.save();
 const token=jwt.sign({id:String(user._id),tenantId:String(t._id),rol:'owner',tokenVersion:0,type:'access'},process.env.JWT_SECRET,{expiresIn:'1h',algorithm:'HS256'});
 const client=(method,url)=>request(app)[method](url).set('Authorization',`Bearer ${token}`);
 const config=await client('post','/api/hacienda/config').send({ambiente:'local',sucursal:'002',terminal:'00003',codigoActividad:'014101',proveedorSistemas:'3101999999'});assert.equal(config.status,200,JSON.stringify(config.body));
 const meta=await client('get','/api/hacienda/ambiente');assert.equal(meta.body.ambiente,'local');assert.equal(meta.body.proveedorSistemas,'3101999999');
 const original=await facturaPrueba();const body=original.toObject();delete body._id;delete body.claveNumerica;delete body.consecutivo;delete body.documentoReferencia;
 const created=await client('post','/api/hacienda/emision').send(body);assert.equal(created.status,201,JSON.stringify(created.body));assert.match(created.body.consecutivo,/^0020000301/);assert.equal(created.body.emisor.provincia,'1');assert.equal(created.body.proveedorSistemas,'3101999999');
 const id=created.body._id;
 assert.equal((await client('get',`/api/hacienda/emision/${id}/estado`)).status,400);
 const signed=await client('post',`/api/hacienda/emision/${id}/firmar`).send({});assert.equal(signed.status,200,JSON.stringify(signed.body));
 const xml=await client('get',`/api/hacienda/emision/${id}/xml`);assert.equal(xml.status,200);assert.match(xml.text,/MockSig/);
 const te=await client('post','/api/hacienda/emision').send({...body,tipoDocumento:'TE',receptor:undefined});assert.equal(te.status,201,JSON.stringify(te.body));
 assert.equal((await client('post',`/api/hacienda/emision/${te.body._id}/firmar`).send({})).status,200);
 for (const tipoDocumento of ['NC','ND']) {
  const referencia={tipoDocReferencia:'01',numeroReferencia:signed.body.clave,fechaEmisionReferencia:new Date(),codigoReferencia:'01',razonReferencia:'Ajuste sintético'};
  const ajuste=await client('post','/api/hacienda/emision').send({...body,tipoDocumento,documentoReferencia:referencia});
  assert.equal(ajuste.status,201,JSON.stringify(ajuste.body));assert.equal(ajuste.body.documentoReferencia.numeroReferencia,referencia.numeroReferencia);
  const persistida=await Factura.findOne({_id:ajuste.body._id,tenantId:t._id});assert.equal(persistida.documentoReferencia.numeroReferencia,referencia.numeroReferencia);
  const incompleta=await client('post','/api/hacienda/emision').send({...body,tipoDocumento});assert.equal(incompleta.status,400);
 }
 const testResponse=await client('post','/api/hacienda/config/test').send({});assert.equal(testResponse.status,200);assert.equal(testResponse.body.enviado,false);
 const change=await client('post','/api/hacienda/config').send({ambiente:'sandbox',sucursal:'002',terminal:'00003',codigoActividad:'014101',proveedorSistemas:'3101999999'});assert.equal(change.status,400);assert.match(change.body.error,/pendientes/);
 const role=await Usuario.findById(user._id);role.rol='peon';await role.save();
 assert.equal((await client('post','/api/hacienda/config/test').send({})).status,200); // owner identity still authorizes config
 const other=await Usuario.create({nombre:'Peón SDK',email:`peon-${new mongoose.Types.ObjectId()}@example.test`,password:'SyntheticPassword123!',cedula:'987654321',rol:'peon',tenantId:t._id});
 const peonToken=jwt.sign({id:String(other._id),tenantId:String(t._id),rol:'peon',tokenVersion:0,type:'access'},process.env.JWT_SECRET,{expiresIn:'1h',algorithm:'HS256'});
 assert.equal((await request(app).post('/api/hacienda/config/test').set('Authorization',`Bearer ${peonToken}`).send({})).status,403);
 assert.equal((await request(app).post('/api/hacienda/emision').set('Authorization',`Bearer ${peonToken}`).send(body)).status,403);
});

test('configuración reemplaza secretos con AAD antiguo y prueba certificado/OAuth sin emitir',async()=>{
 const {certificadoPrueba}=require('./fixtures.cjs');const controller=require('../controllers/haciendaConfigController');
 const {encrypt}=require('../utils/crypto');const t=await tenantPrueba('sandbox');
 t.configuracionHacienda.pinCertificado=encrypt('old-pin',{tenantId:'undefined',field:'configuracionHacienda.pinCertificado'});await t.save();
 const p12=certificadoPrueba();const calls=setupTransport();let error;let payload;
 const req={tenant:{_id:t._id},body:{ambiente:'sandbox',sucursal:'001',terminal:'00001',codigoActividad:'014101',proveedorSistemas:'3101999999',certificadoP12Base64:p12,pinCertificado:'synthetic-pin',usuarioHacienda:'cpf-synthetic',passwordHacienda:'replacement-password'}};
 const res={json:data=>{payload=data;}};
 await controller.guardarConfig(req,res,e=>{error=e;});assert.equal(error,undefined,error?.message);assert.equal(payload.configurado,true);
 const saved=await Tenant.findById(t._id).select('+configuracionHacienda.certificadoP12Base64 +configuracionHacienda.pinCertificado +configuracionHacienda.passwordHacienda +configuracionHacienda.usuarioHacienda');
 assert.notEqual(saved.configuracionHacienda.certificadoP12Base64,p12);assert.equal(saved.configuracionHacienda.obtenerCertificadoP12(),p12);
 await controller.probarConexion(req,res,e=>{error=e;});assert.equal(error,undefined,error?.message);assert.equal(payload.success,true);assert.equal(payload.enviado,false);
 assert.equal(calls.length,1);assert.ok(calls[0].url.includes('/token'));assert.ok(!JSON.stringify(payload).includes('replacement-password'));
 await controller.obtenerConfig(req,res,e=>{error=e;});assert.equal(error,undefined);assert.ok(!JSON.stringify(payload).includes(p12));
});
