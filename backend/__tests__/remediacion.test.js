const request = require('supertest');
const app = require('../server');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const { generarCSV } = require('../services/declaracionService');
const Ingreso = require('../models/Ingreso');
const AuditLog = require('../models/AuditLog');
const { audit } = require('../utils/audit');
const { runWithTenantContext } = require('../utils/tenantContext');

describe('Regresiones remediacion', () => {
  test('F-20: roles por acciones y dos fincas se aplican en la API real',async()=>{
    const mongoose=require('mongoose'),jwt=require('jsonwebtoken'),Factura=require('../models/Factura');
    const users=await Usuario.create(['owner','admin','contador','peon'].map(rol=>({nombre:rol,email:`${rol}@roles.example.test`,password:'PasswordPrueba123!',rol})));
    const a=await Tenant.crearParaUsuario({nombreFinca:'A',owner:users[0]._id,plan:'pro'});
    const b=await Tenant.crearParaUsuario({nombreFinca:'B',owner:new mongoose.Types.ObjectId(),plan:'free'});
    const own=await Factura.collection.insertOne({tenantId:a._id,usuario:users[0]._id});
    const foreign=await Factura.collection.insertOne({tenantId:b._id,usuario:new mongoose.Types.ObjectId()});
    for(const user of users){
      user.tenantId=a._id;await user.save();
      const token=jwt.sign({id:user._id,tenantId:a._id,tokenVersion:0},process.env.JWT_SECRET,{expiresIn:'1h',algorithm:'HS256'});
      const call=(method,id)=>request(app)[method](`/api/facturas/${id}`).set('Authorization',`Bearer ${token}`);
      expect((await call('get',own.insertedId)).status).toBe(user.rol==='peon'?403:200);
      expect((await call('get',foreign.insertedId)).status).toBe(user.rol==='peon'?403:404);
      expect((await call('delete',foreign.insertedId)).status).toBe(['owner','admin'].includes(user.rol)?404:403);
    }
    expect(await Factura.collection.countDocuments()).toBe(2);
  });
  async function sesion(rol = 'owner', plan = 'free') {
    const u = await Usuario.create({nombre:'Prueba',email:'remediacion@example.test',password:'PasswordPrueba123!',rol,cedula:'102220333'});
    // A field worker is a member, not the legal owner of this finca.
    const t = await Tenant.crearParaUsuario({nombreFinca:'Prueba',owner:rol === 'peon' ? new (require('mongoose').Types.ObjectId)() : u._id,plan});
    u.tenantId=t._id; u.rol=rol; await u.save();
    const login=await request(app).post('/api/auth/login').send({email:u.email,password:'PasswordPrueba123!'});
    return {u,t,token:login.body.token};
  }
  test('S-02: endpoints D150 retirados responden API no encontrada',async()=>{
    const {token}=await sesion();
    for(const url of ['/api/hacienda/d150/conciliacion','/api/hacienda/d150/reporte/pdf','/api/hacienda/d150/reporte/excel']) {
      const r=await request(app).get(url).set('Authorization',`Bearer ${token}`);
      expect(r.status).toBe(404); expect(r.body.error).toBe('API no encontrada');
    }
  });
  test('F-20: peon no puede leer contabilidad ni borrar facturas',async()=>{
    const {token}=await sesion('peon');
    expect((await request(app).get('/api/ingresos').set('Authorization',`Bearer ${token}`)).status).toBe(403);
    expect((await request(app).delete('/api/facturas/507f1f77bcf86cd799439011').set('Authorization',`Bearer ${token}`)).status).toBe(403);
    for (const url of ['/api/costos','/api/hacienda/emision','/api/facturacion','/api/dashboard/resumen']) {
      const r=await request(app).get(url).set('Authorization',`Bearer ${token}`);
      expect(r.status).toBe(403);
    }
  });
  test('rutas antiguas no permiten inventar aceptacion fiscal manualmente',async()=>{
    const {u,t,token}=await sesion();
    const doc=await require('../models/FacturaEmision').collection.insertOne({tenantId:t._id,usuario:u._id,estado:'borrador'});
    const r=await request(app).put(`/api/facturacion/${doc.insertedId}/estado`).set('Authorization',`Bearer ${token}`).send({estado:'aceptada'});
    // Mount is read from the application, not a second test-only router.
    expect(r.status).toBe(404);
    expect((await require('../models/FacturaEmision').collection.findOne({_id:doc.insertedId})).estado).toBe('borrador');
  });
  test('FEC y REP históricos siguen visibles y no admiten firma, envío ni cancelación', async () => {
    const { u, t, token } = await sesion();
    const Emision = require('../models/FacturaEmision');
    for (const tipoDocumento of ['FEC', 'REP']) {
      const doc = await Emision.collection.insertOne({
        tenantId: t._id, usuario: u._id, tipoDocumento, estado: 'borrador',
        fechaEmision: new Date(), consecutivo: '00100001080000000001',
      });
      const path = `/api/hacienda/emision/${doc.insertedId}`;
      for (const action of ['firmar', 'enviar', 'cancelar']) {
        expect((await request(app).post(path + '/' + action).set('Authorization', `Bearer ${token}`).send({})).status).toBe(410);
      }
      expect((await request(app).get(path + '/estado').set('Authorization', `Bearer ${token}`)).status).toBe(410);
      const history = await request(app).get('/api/facturacion').set('Authorization', `Bearer ${token}`);
      expect(history.body.facturas.some(f => f._id === String(doc.insertedId))).toBe(true);
    }
  });
  test('F-15: formulas con delimitadores y saltos siguen neutralizadas',()=>{
    for(const texto of ['=SUM(1,2)','+SUM("a","b")','@x\ny']) {
      const csv=generarCSV([{proveedor:texto}]);
      expect(csv).toContain(`"'${texto.replace(/"/g,'""')}"`);
    }
  });
  test('F-36: editar solamente litros recalcula montos',async()=>{
    const {u,t}=await sesion();
    await runWithTenantContext({tenantId:t._id},async()=>{
      const i=await Ingreso.create({usuario:u._id,tenantId:t._id,fecha:new Date(),descripcion:'Leche',categoriaIngreso:'venta_leche',litrosVendidos:10,precioUnitario:100,montoSubtotal:1000,montoTotal:1000,tasaIVA:1});
      i.litrosVendidos=20; await i.save();
      expect(i.montoSubtotal).toBe(2000); expect(i.montoTotal).toBe(2020);
    });
  });
  test('F-23: resultado y metadata legacy se persisten',async()=>{
    await audit(null,{accion:'auth.login_success',resultado:'success',metadata:{canal:'test'}});
    const log=await AuditLog.findOne({accion:'auth.login_success'});
    expect(log.resultado).toBe('exito'); expect(log.metadatos.canal).toBe('test');
  });
  test('F-21: setup no desactiva un factor activo',async()=>{
    const {u,token}=await sesion();
    u.setMfaSecret('JBSWY3DPEHPK3PXP'); u.mfa.enabled=true; await u.save();
    const r=await request(app).post('/api/auth/mfa/setup').set('Authorization',`Bearer ${token}`);
    expect(r.status).toBe(409);
    const actual=await Usuario.findById(u._id).select('+mfa.secretEncrypted');
    expect(actual.mfa.enabled).toBe(true); expect(actual.getMfaSecret()).toBe('JBSWY3DPEHPK3PXP');
  });
  test('F-41: gracia vencida no constituye tenant activo',()=>{
    const t=new Tenant({estado:'periodo_gracia',periodoGraciaFin:new Date(0)});
    expect(t.estaActivo()).toBe(false);
  });
});
