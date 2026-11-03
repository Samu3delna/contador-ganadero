process.env.RL_API_MAX='1';
const request=require('supertest'),express=require('express');
const {apiLimiter}=require('../middleware/rateLimiters');
test('S-13: webhooks siguen accesibles tras agotar limitador montado en /api',async()=>{
  const app=express();app.use('/api',apiLimiter);app.all('/api/*',(req,res)=>res.sendStatus(200));
  expect((await request(app).get('/api/normal')).status).toBe(200);
  expect((await request(app).get('/api/normal')).status).toBe(429);
  for(const path of ['/api/webhooks/email','/api/webhooks/whatsapp','/api/onvo/webhook'])expect((await request(app).post(path)).status).toBe(200);
  expect((await request(app).get('/api/webhooks-falso/email')).status).toBe(429);
});
test('F-30: CodigoTarifaIVA v4.4 conserva tarifa 1% sin falsa alerta 13%',()=>{
  const clave='506'.padEnd(50,'0');
  const xml=`<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"><Clave>${clave}</Clave><FechaEmision>2026-11-01T12:00:00-06:00</FechaEmision><Emisor><Nombre>Proveedor</Nombre></Emisor><DetalleServicio><LineaDetalle><NumeroLinea>1</NumeroLinea><Cantidad>1</Cantidad><Detalle>Concentrado para ganado</Detalle><PrecioUnitario>1000</PrecioUnitario><SubTotal>1000</SubTotal><Impuesto><Codigo>01</Codigo><CodigoTarifaIVA>02</CodigoTarifaIVA><Tarifa>1</Tarifa><Monto>10</Monto></Impuesto><ImpuestoNeto>10</ImpuestoNeto><MontoTotalLinea>1010</MontoTotalLinea></LineaDetalle></DetalleServicio><ResumenFactura><TotalVenta>1000</TotalVenta><TotalVentaNeta>1000</TotalVentaNeta><TotalImpuesto>10</TotalImpuesto><TotalComprobante>1010</TotalComprobante></ResumenFactura></FacturaElectronica>`;
  const doc=require('../services/xmlParserService').parsearFacturaXML(xml);
  expect(doc.claveNumerica).toBe(clave);expect(doc.lineaDetalle[0].impuesto.codigoTarifa).toBe('02');expect(doc.lineaDetalle[0].impuesto.tarifa).toBe(1);
  expect(doc.resumenValidacionTarifa.ahorrosPerdidos).toBe(0);
});
test('F-07: deteccion por consecutivo conserva codigos oficiales de FEC y REP',()=>{
  const {detectarTipoDocumento}=require('../services/xmlParserService');
  expect(detectarTipoDocumento({NumeroConsecutivo:'00100001080000000001'},'Comprobante')).toBe('Factura Electrónica de Compra');
  expect(detectarTipoDocumento({NumeroConsecutivo:'00100001100000000001'},'Comprobante')).toBe('Recibo Electrónico de Pago');
});
