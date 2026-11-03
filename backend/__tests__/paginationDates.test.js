const mongoose=require('mongoose'),request=require('supertest'),jwt=require('jsonwebtoken');
const app=require('../server');const Usuario=require('../models/Usuario'),Tenant=require('../models/Tenant'),Factura=require('../models/Factura');
test('F-03: resumen incluye mas de 100 facturas y calendario filtra antes de paginar',async()=>{
  const user=await Usuario.create({nombre:'Paginas',email:'pages@example.test',password:'SyntheticPassword123!',rol:'owner'});
  const tenant=await Tenant.crearParaUsuario({nombreFinca:'Paginas',owner:user._id});user.tenantId=tenant._id;await user.save();
  const token=jwt.sign({id:user._id,tenantId:tenant._id,tokenVersion:0},process.env.JWT_SECRET,{expiresIn:'1h',algorithm:'HS256'});
  const docs=Array.from({length:105},()=>({tenantId:tenant._id,usuario:user._id,fechaEmision:new Date('2026-11-15T12:00:00Z'),categoriaIA:'otros',estado:'procesada',emisor:{nombre:'Proveedor'},resumenFactura:{totalVentaNeta:100,totalVenta:100,totalImpuesto:0,totalComprobante:100}}));
  docs.push({...docs[0],fechaEmision:new Date('2026-01-02T12:00:00Z')});await Factura.collection.insertMany(docs);
  const get=url=>request(app).get(url).set('Authorization',`Bearer ${token}`);
  const resumen=await get('/api/facturas/resumen?limit=50');expect(resumen.status).toBe(200);expect(resumen.body.categorias.otros).toBe(10600);expect(resumen.body.totalPaginas).toBe(3);
  const pagina=await get('/api/facturas?limit=100&page=2');expect(pagina.body.facturas).toHaveLength(6);expect(pagina.body.pagina).toBe(2);
  const enero=await get('/api/facturas?mes=1&anio=2026&limit=100');expect(enero.body.facturas).toHaveLength(1);expect(enero.body.total).toBe(1);
  expect((await get('/api/facturas?mes=13&anio=2026')).status).toBe(400);
});
test('F-27: fechas civiles validas mantienen dia y limites fiscales usan Costa Rica',()=>{
  const {parsearFechaCivil}=require('../utils/fechaCivil');
  expect(parsearFechaCivil('2026-10-31').toISOString()).toBe('2026-10-31T12:00:00.000Z');
  expect(()=>parsearFechaCivil('2026-02-31')).toThrow();
  const {inicio,fin}=require('../utils/costaRicaTax').obtenerRangoFechasCuatrimestre(1,2026);
  expect(inicio.toISOString()).toBe('2026-01-01T06:00:00.000Z');expect(fin.toISOString()).toBe('2026-05-01T05:59:59.999Z');
});
