const mongoose=require('mongoose'),request=require('supertest'),jwt=require('jsonwebtoken');
const app=require('../server');
const Tenant=require('../models/Tenant'),Usuario=require('../models/Usuario'),Factura=require('../models/FacturaEmision');
let original,token,tenant,user;
beforeEach(async()=>{
  user=await Usuario.create({nombre:'REP',email:'rep@example.test',password:'SyntheticPassword123!',rol:'owner'});
  tenant=await Tenant.crearParaUsuario({nombreFinca:'REP',owner:user._id,plan:'pro'});user.tenantId=tenant._id;await user.save();
  Object.assign(tenant.configuracionHacienda,{ambiente:'local',proveedorSistemas:'3101999999',codigoActividad:'014101'});await tenant.save();
  token=jwt.sign({id:user._id,tenantId:tenant._id,tokenVersion:0},process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'1h'});
  const partes={nombre:'Parte sintetica',cedula:{tipo:'01',numero:'123456789'},provincia:'1',canton:'01',distrito:'01',ubicacion:'Prueba',correo:'parte@example.test'};
  const result=await Factura.collection.insertOne({tenantId:tenant._id,usuario:user._id,tipoDocumento:'FE',estado:'aceptada',ambiente:'local',condicionVenta:'08',claveNumerica:'8'.repeat(50),consecutivo:'00100001010000000001',fechaEmision:new Date(),moneda:'CRC',tipoCambio:1,emisor:partes,receptor:partes,resumenFactura:{totalComprobante:100}});
  original=result.insertedId;await Factura.init();
});
const crear=(monto,key)=>{let req=request(app).post('/api/hacienda/rep').set('Authorization',`Bearer ${token}`);if(key)req=req.set('Idempotency-Key',key);return req.send({facturaIdOriginal:String(original),montoAbono:monto});};
test('F-32: reservas concurrentes no exceden saldo y cancelacion libera una sola vez',async()=>{
  const responses=await Promise.all([crear(60),crear(60)]);expect(responses.map(r=>r.status).sort()).toEqual([201,400]);
  const rep=responses.find(r=>r.status===201).body;
  expect((await Factura.findById(original)).saldoRepReservado).toBe(60);
  const {verificar}=require('../services/repReservations');await expect(verificar(await Factura.findById(rep._id))).resolves.toBeUndefined();
  const cancelar=()=>request(app).post(`/api/hacienda/emision/${rep._id}/cancelar`).set('Authorization',`Bearer ${token}`).send({});
  expect((await cancelar()).status).toBe(200);expect((await cancelar()).status).toBe(200);
  expect((await Factura.findById(original)).saldoRepReservado).toBe(0);
  expect((await crear(60)).status).toBe(201);
});
test('F-32: reentrega con Idempotency-Key conserva borrador y reserva',async()=>{
  const first=await crear(20,'pago-unico');expect(first.status).toBe(201);
  const retry=await crear(20,'pago-unico');expect(retry.status).toBe(200);expect(retry.body._id).toBe(first.body._id);
  expect((await Factura.findById(original)).saldoRepReservado).toBe(20);
  expect((await crear(30,'pago-unico')).status).toBe(409);
});
