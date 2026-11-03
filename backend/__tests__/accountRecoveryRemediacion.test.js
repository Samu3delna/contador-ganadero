const request=require('supertest');
const app=require('../server');
const Usuario=require('../models/Usuario');
const Tenant=require('../models/Tenant');
const Notification=require('../models/AccountNotification');
const {tick}=require('../services/accountNotifications');
test('F-24: respuesta uniforme, notificacion cifrada durable y enlace de un solo uso',async()=>{
  const u=await Usuario.create({nombre:'Recuperar',email:'recover@example.test',password:'SyntheticPassword123!'});
  const t=await Tenant.crearParaUsuario({nombreFinca:'Recuperacion',owner:u._id});u.tenantId=t._id;await u.save();
  const existente=await request(app).post('/api/auth/forgot-password').send({email:u.email});
  const ausente=await request(app).post('/api/auth/forgot-password').send({email:'missing@example.test'});
  expect(existente.status).toBe(200);expect(existente.body).toEqual(ausente.body);
  expect(await Notification.countDocuments()).toBe(1);
  const sender=jest.fn().mockResolvedValue({success:true});await tick({enviar:sender});
  const text=sender.mock.calls[0][0].text;const token=text.match(/#token=([a-f0-9]{64})/)[1];
  expect(JSON.stringify(await Notification.findOne().lean())).not.toContain(token);
  const responses=await Promise.all([1,2].map(()=>request(app).post('/api/auth/reset-password').send({token,passwordNueva:'NewSyntheticPassword123!'})));
  expect(responses.map(r=>r.status).sort()).toEqual([200,400]);
  await expect((await Usuario.findById(u._id).select('+password')).compararPassword('NewSyntheticPassword123!')).resolves.toBe(true);
});
test('F-24: fallo de transporte conserva notificacion para reintento sin exponer token',async()=>{
  const u=await Usuario.create({nombre:'Pendiente',email:'retry-recover@example.test',password:'SyntheticPassword123!'});
  await request(app).post('/api/auth/forgot-password').send({email:u.email});
  await tick({enviar:jest.fn().mockResolvedValue({success:false})});
  const doc=await Notification.findOne();expect(doc.estado).toBe('pendiente');expect(doc.intentos).toBe(1);
  await Notification.updateOne({_id:doc._id},{$set:{claimHasta:new Date(0)}});
  const sender=jest.fn().mockResolvedValue({success:true});await tick({enviar:sender});
  expect(sender).toHaveBeenCalledTimes(1);expect((await Notification.findById(doc._id)).estado).toBe('enviada');
});
