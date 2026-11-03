const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Inventario = require('../models/Inventario');
const Costo = require('../models/CostoProduccion');
const jwt = require('jsonwebtoken');
let user, tenant, token;
beforeEach(async () => {
  user=await Usuario.create({nombre:'Costos',email:'costs@example.test',password:'SyntheticPassword123!',rol:'owner'});
  tenant=await Tenant.crearParaUsuario({nombreFinca:'Costos',owner:user._id,plan:'pro'});
  user.tenantId=tenant._id;await user.save();
  token=jwt.sign({id:user._id,tenantId:tenant._id,tokenVersion:0},process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'1h'});
});
test('S-14: alimento por presentacion y huevos por unidad/docena usan kg/cartones',()=>{
  const c=new Costo({usuario:user._id,tenantId:tenant._id,periodoFiscal:2026,centrosCosto:[
    {referenciaId:'pez',tipoActividad:'acuicultura_tilapia',consumos:[{tipoInsumo:'alimento_concentrado',cantidad:2,unidadMedida:'saco',pesoUnidadKg:40,costoUnitario:5000,costoTotal:10000}],producciones:[{tipoProducto:'tilapia',cantidad:10,unidadMedida:'kg'}]},
    {referenciaId:'huevo',tipoActividad:'aves_postura',consumos:[{tipoInsumo:'otro',cantidad:1,costoUnitario:10000,costoTotal:10000}],producciones:[{tipoProducto:'huevo',cantidad:30,unidadMedida:'unidad'}]},
  ]});
  expect(c.recalcularIndicadoresCentro('pez').factorConversionAlimenticia).toBe(8);
  expect(c.recalcularIndicadoresCentro('huevo').costoProduccionPorCartonHuevos).toBe(10000);
  c.centrosCosto[1].producciones[0].cantidad=2.5;c.centrosCosto[1].producciones[0].unidadMedida='docena';
  expect(c.recalcularIndicadoresCentro('huevo').costoProduccionPorCartonHuevos).toBe(10000);
  c.centrosCosto[0].consumos[0].pesoUnidadKg=undefined;
  expect(c.validateSync().errors['centrosCosto.0.consumos.0.pesoUnidadKg']).toBeTruthy();
});
test('F-40: inicializacion concurrente deja un inventario y un costo por periodo',async()=>{
  await Promise.all([Inventario.init(),Costo.init()]);
  const results=await Promise.all(Array.from({length:8},()=>request(app).get('/api/inventario').set('Authorization',`Bearer ${token}`)));
  expect(results.every(r=>r.status===200)).toBe(true);expect(await Inventario.countDocuments({tenantId:tenant._id})).toBe(1);
  const costs=await Promise.all(Array.from({length:8},()=>request(app).get('/api/costos?periodoFiscal=2026').set('Authorization',`Bearer ${token}`)));
  expect(costs.every(r=>r.status===200)).toBe(true);expect(await Costo.countDocuments({tenantId:tenant._id,periodoFiscal:2026})).toBe(1);
});
test('F-39: referencia repetida entre periodos solo modifica el periodo explicito',async()=>{
  await Costo.create([2025,2026].map(periodoFiscal=>({usuario:user._id,tenantId:tenant._id,periodoFiscal,centrosCosto:[{referenciaId:'lote',tipoActividad:'aves_postura'}]})));
  const url='/api/costos/centros/lote/produccion';
  const body={tipoProducto:'huevo',cantidad:30,unidadMedida:'unidad'};
  expect((await request(app).post(url).set('Authorization',`Bearer ${token}`).send(body)).status).toBe(400);
  expect((await request(app).post(url).set('Authorization',`Bearer ${token}`).send({...body,periodoFiscal:2025})).status).toBe(201);
  expect((await Costo.findOne({tenantId:tenant._id,periodoFiscal:2025})).centrosCosto[0].producciones).toHaveLength(1);
  expect((await Costo.findOne({tenantId:tenant._id,periodoFiscal:2026})).centrosCosto[0].producciones).toHaveLength(0);
});
test('F-40: migracion detecta duplicados sin eliminarlos y dry-run no crea indice',async()=>{
  await Inventario.init();await Inventario.collection.dropIndex('tenant_inventory_unique');
  await Inventario.collection.insertMany([{tenantId:tenant._id},{tenantId:tenant._id}]);
  const {migrate}=require('../scripts/migrateInventoryIdentity');
  expect((await migrate({dryRun:true})).conflictos).toHaveLength(1);
  expect((await migrate({dryRun:false})).aplicado).toBe(false);
  expect(await Inventario.collection.countDocuments({tenantId:tenant._id})).toBe(2);
  await Inventario.collection.deleteMany({tenantId:tenant._id});
  expect((await migrate({dryRun:false})).aplicado).toBe(true);
  expect((await migrate({dryRun:false})).aplicado).toBe(true);
});
