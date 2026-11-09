const request=require('supertest');
const express=require('express');
const Usuario=require('../models/Usuario');
const Tenant=require('../models/Tenant');
const {generarToken}=require('../controllers/authController');
const {errorHandler}=require('../middleware/errorMiddleware');
jest.mock('../services/aiService',()=>({categorizarFactura:jest.fn(async()=>({categoria:'sin_clasificar',confianza:1}))}));
const app=express();app.use(express.json());app.use('/api/facturas',require('../routes/facturaRoutes'));app.use(errorHandler);
let token,other;
beforeEach(async()=>{const t=await Tenant.crearParaUsuario({nombreFinca:'Upload',owner:null,plan:'free'});const u=await Usuario.create({nombre:'Upload',email:'upload@example.test',password:'UploadSecure123!',tenantId:t._id,rol:'dueño'});token=generarToken(u,t._id);const t2=await Tenant.crearParaUsuario({nombreFinca:'Otra',owner:null,plan:'pro'});const u2=await Usuario.create({nombre:'Otra',email:'otherupload@example.test',password:'UploadSecure123!',tenantId:t2._id,rol:'dueño'});other=generarToken(u2,t2._id);});
const xml='<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"><Clave>50607112600310112345600100001010000000001112345678</Clave><NumeroConsecutivo>00100001010000000001</NumeroConsecutivo><FechaEmision>2026-11-07T12:00:00-06:00</FechaEmision><Emisor><Nombre>Proveedor sintético</Nombre><Identificacion><Tipo>02</Tipo><Numero>3101123456</Numero></Identificacion></Emisor><ResumenFactura><TotalVenta>1000</TotalVenta><TotalImpuesto>0</TotalImpuesto><TotalComprobante>1000</TotalComprobante></ResumenFactura></FacturaElectronica>';
test('XML real se procesa, detecta duplicado y respeta tenant',async()=>{const upload=()=>request(app).post('/api/facturas/upload').set('Authorization','Bearer '+token).attach('archivoXML',Buffer.from(xml),{filename:'factura.xml',contentType:'application/xml'});const r=await upload();expect(r.status).toBe(201);expect(r.body.factura._id).toBeTruthy();expect((await upload()).body.duplicada).toBe(true);expect((await request(app).get('/api/facturas/'+r.body.factura._id).set('Authorization','Bearer '+other)).status).toBe(404);});
test.each([['foto.jpg','image/jpeg'],['texto.txt','text/plain'],['foto.xml','application/xml']])('rechaza %s sin registrar una factura',async(filename,contentType)=>{const r=await request(app).post('/api/facturas/upload').set('Authorization','Bearer '+token).attach('archivoXML',Buffer.from('not an XML invoice'),{filename,contentType});expect(r.status).toBeGreaterThanOrEqual(400);const list=await request(app).get('/api/facturas').set('Authorization','Bearer '+token);expect(list.body.total).toBe(0);});

test('la cédula del XML no puede redirigir una carga autenticada a otra finca', async () => {
  await Usuario.updateOne({email:'otherupload@example.test'}, {$set:{cedula:{tipo:'01',numero:'123456789'}}});
  const foreignXml = xml.replace('<ResumenFactura>', '<Receptor><Nombre>Otra finca</Nombre><Identificacion><Tipo>01</Tipo><Numero>123456789</Numero></Identificacion></Receptor><ResumenFactura>');
  const r = await request(app).post('/api/facturas/upload').set('Authorization','Bearer '+token)
    .attach('archivoXML', Buffer.from(foreignXml), {filename:'receptor.xml',contentType:'application/xml'});
  expect(r.status).toBe(201);
  const owner = await Usuario.findOne({email:'upload@example.test'});
  expect(String(r.body.factura.tenantId)).toBe(String(owner.tenantId));
  expect((await request(app).get('/api/facturas/'+r.body.factura._id).set('Authorization','Bearer '+other)).status).toBe(404);
});
