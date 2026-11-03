const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');
const Emision = require('../models/FacturaEmision');
const Ingreso = require('../models/Ingreso');
const { calcularIVACuatrimestral, calcularRentaAnual } = require('../services/impuestoService');
const { generarDatosExportacion } = require('../services/declaracionService');
const { generarConciliacion } = require('../services/d150Service');
const { normalizarFactura } = require('../services/contabilidadService');
let user, tenant;
const fecha = new Date('2026-02-15T12:00:00Z');
beforeEach(async () => {
  user = await Usuario.create({nombre:'Contable',email:'ledger@example.test',password:'SyntheticPassword123!'});
  tenant = await Tenant.crearParaUsuario({nombreFinca:'Contable',owner:user._id,plan:'pro'});
  user.tenantId=tenant._id; await user.save();
});
const scope = () => ({ tenantId:tenant._id, usuario:user._id });
function compra(extra={}) { return { ...scope(), fechaEmision:fecha, periodoFiscal:2026, cuatrimestre:1,
  emisor:{nombre:'Proveedor',cedula:{numero:'3100000001'}}, tipoDocumento:'Factura Electrónica', estado:'procesada',esDeducible:true,tasaIVA:13,
  resumenFactura:{totalVenta:100,totalVentaNeta:100,totalImpuesto:13,totalComprobante:113}, ...extra }; }
test('F-10/S-12: venta emitida se incluye, ingreso por misma clave no se duplica y compañero ve datos', async () => {
  const clave='7'.repeat(50);
  await Emision.collection.insertOne({ ...scope(), fechaEmision:fecha, tipoDocumento:'FE',estado:'aceptada',claveNumerica:clave,
    receptor:{nombre:'Cliente'},resumenFactura:{totalVenta:1000,totalVentaNeta:1000,totalImpuesto:10,totalComprobante:1010},
    lineaDetalle:[{descripcion:'Venta',subtotal:1000,impuesto:{tarifa:1,monto:10},impuestoNeto:10,montoTotal:1010}] });
  await Ingreso.collection.insertOne({...scope(),fecha,descripcion:'Manual duplicado',montoSubtotal:1000,ivaVenta:10,montoTotal:1010,tasaIVA:1,facturaElectronica:{claveNumerica:clave}});
  const companion=new mongoose.Types.ObjectId();
  const iva=await calcularIVACuatrimestral(companion,1,2026,tenant._id);
  expect(iva.ivaCobrado).toBe(10); expect(iva.totalIngresos).toBe(1010);
  expect((await calcularRentaAnual(companion,2026,tenant._id)).ingresosBrutos).toBe(1000);
  const datos=await generarDatosExportacion(companion,2026,1,tenant._id);
  expect(datos.filter(d=>d.tipo==='INGRESO')).toHaveLength(1); expect(datos[0].subtotal).toBe(1000);
});
test('F-11/F-12: compra USD y NC compensan base e IVA en reportes sin doble conversion', async () => {
  await Factura.collection.insertOne(compra({moneda:'USD',tipoCambio:500}));
  let iva=await calcularIVACuatrimestral(user._id,1,2026,tenant._id);
  expect(iva.ivaPagado).toBe(6500); expect(iva.totalGastos).toBe(56500);
  const exportacion=await generarDatosExportacion(user._id,2026,1,tenant._id); expect(exportacion[0].subtotal).toBe(50000);
  const norm=normalizarFactura(compra({moneda:'USD',tipoCambio:500})); expect(normalizarFactura(norm).resumenFactura.totalComprobante).toBe(56500);
  await Factura.collection.insertOne(compra({moneda:'USD',tipoCambio:500,tipoDocumento:'Nota de Crédito'}));
  iva=await calcularIVACuatrimestral(user._id,1,2026,tenant._id); expect(iva.ivaPagado).toBe(0);expect(iva.totalGastos).toBe(0);
  const d150=await generarConciliacion({usuarioId:user._id,tenantId:tenant._id,mes:2,anio:2026});
  expect(JSON.stringify(d150)).not.toContain('NaN');
  const datos=await generarDatosExportacion(user._id,2026,1,tenant._id); expect(datos.reduce((s,d)=>s+d.iva,0)).toBe(0);
});
test('F-13/F-14/F-35: base neta y cero explicito respetados; no deducible no genera credito IVA', async () => {
  await Factura.collection.insertOne(compra({resumenFactura:{totalVenta:1000,totalVentaNeta:800,totalDescuentos:200,totalImpuesto:0,totalComprobante:800},
    lineaDetalle:[{subtotal:800,impuesto:{tarifa:13,monto:104},exoneracion:{montoExoneracion:104},impuestoNeto:0,montoTotal:800}]}));
  await Factura.collection.insertOne(compra({esDeducible:false}));
  const renta=await calcularRentaAnual(user._id,2026,tenant._id); expect(renta.gastosDeducibles).toBe(800);
  const iva=await calcularIVACuatrimestral(user._id,1,2026,tenant._id); expect(iva.ivaPagado).toBe(0);
  const datos=await generarDatosExportacion(user._id,2026,1,tenant._id); expect(datos.find(d=>d.total===800).subtotal).toBe(800);
  const d150=await generarConciliacion({usuarioId:user._id,tenantId:tenant._id,mes:2,anio:2026});
  expect(d150.totales.comprasIVACredito).toBe(0);
  const cero=normalizarFactura(compra({resumenFactura:{totalVenta:100,totalVentaNeta:0,totalImpuesto:0,totalComprobante:0}}));
  expect(cero.resumenFactura.totalVentaNeta).toBe(0);
});
test('F-33/S-12: contexto chat suma todos los registros de la finca y usa campos reales', async () => {
  await Factura.collection.insertMany(Array.from({length:25},()=>compra()));
  await Ingreso.collection.insertMany(Array.from({length:15},()=>({...scope(),fecha,descripcion:'Leche',montoSubtotal:100,montoTotal:101,ivaVenta:1})));
  const ctx=await require('../controllers/chatController').obtenerContextoUsuario(new mongoose.Types.ObjectId(),tenant._id);
  expect(ctx.resumen.totalFacturas).toBe(25); expect(ctx.resumen.totalGastos).toBe(2825);
  expect(ctx.resumen.totalIngresos).toBe(1515); expect(ctx.ultimosIngresos[0].concepto).toBe('Leche');
  expect(ctx.ultimosIngresos[0].monto).toBe(101);
});

test('F-13/F-14: descuento total y exoneracion parcial coinciden en IVA, renta, D150 y exportacion', async () => {
  await Factura.collection.insertOne(compra({resumenFactura:{totalVenta:100,totalVentaNeta:0,totalDescuentos:100,totalImpuesto:0,totalComprobante:0}}));
  await Factura.collection.insertOne(compra({resumenFactura:{totalVenta:100,totalVentaNeta:100,totalImpuesto:5,totalComprobante:105},
    lineaDetalle:[{subtotal:100,impuesto:{tarifa:13,monto:13},exoneracion:{montoExoneracion:8},impuestoNeto:5,montoTotal:105}]}));
  await Ingreso.collection.insertOne({...scope(),fecha,descripcion:'Exonerada',montoSubtotal:100,ivaVenta:0,montoTotal:100,tasaIVA:13});
  const iva=await calcularIVACuatrimestral(user._id,1,2026,tenant._id);
  expect(iva.ivaPagado).toBe(5);expect(iva.ivaCobrado).toBe(0);
  expect((await calcularRentaAnual(user._id,2026,tenant._id)).gastosDeducibles).toBe(100);
  const d150=await generarConciliacion({usuarioId:user._id,tenantId:tenant._id,mes:2,anio:2026});
  expect(d150.totales.comprasIVACredito).toBe(5);expect(d150.totales.ventasIVADebito).toBe(0);
  const exported=await generarDatosExportacion(user._id,2026,1,tenant._id);
  expect(exported.filter(d=>d.tipo==='GASTO').reduce((sum,d)=>sum+d.subtotal,0)).toBe(100);
  expect(d150.documentos.find(d=>d.tipo==='COMPRA' && d.total===0).subtotal).toBe(0);
});
