const request = require('supertest');
const app = require('../../server');
const Usuario = require('../../models/Usuario');
const Tenant = require('../../models/Tenant');
const Factura = require('../../models/Factura');
const Ingreso = require('../../models/Ingreso');
const CostoProduccion = require('../../models/CostoProduccion');
const { runWithTenantContext } = require('../../utils/tenantContext');

describe('Bloque 4: Aislamiento Obligatorio Multi-Tenant (AsyncLocalStorage + Mongoose Plugin)', () => {
  let userA, tenantA, tokenA;
  let userB, tenantB, tokenB;

  beforeEach(async () => {
    userA = await Usuario.create({
      nombre: 'Org A Owner',
      email: 'orga@finca.cr',
      password: 'PasswordOrgA123!',
      cedula: '101110111',
      rol: 'owner',
    });
    tenantA = await Tenant.crearParaUsuario({
      nombreFinca: 'Finca Org A',
      owner: userA._id,
      plan: 'pro',
    });
    userA.tenantId = tenantA._id;
    await userA.save();

    userB = await Usuario.create({
      nombre: 'Org B Owner',
      email: 'orgb@finca.cr',
      password: 'PasswordOrgB123!',
      cedula: '202220222',
      rol: 'owner',
    });
    tenantB = await Tenant.crearParaUsuario({
      nombreFinca: 'Finca Org B',
      owner: userB._id,
      plan: 'pro',
    });
    userB.tenantId = tenantB._id;
    await userB.save();

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'orga@finca.cr', password: 'PasswordOrgA123!' });
    tokenA = loginA.body.token;

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'orgb@finca.cr', password: 'PasswordOrgB123!' });
    tokenB = loginB.body.token;
  });

  it('lanza TENANT_CONTEXT_MISSING si se consulta un modelo protegido sin contexto de tenant ni skipTenant', async () => {
    await expect(Factura.find({})).rejects.toThrow(/TENANT_CONTEXT_MISSING/);
    await expect(Ingreso.findOne({})).rejects.toThrow(/TENANT_CONTEXT_MISSING/);
    await expect(CostoProduccion.countDocuments({})).rejects.toThrow(/TENANT_CONTEXT_MISSING/);
    await expect(Factura.aggregate([{ $match: {} }])).rejects.toThrow(/TENANT_CONTEXT_MISSING/);
  });

  it('permite consultas de sistema únicamente cuando se pasa explícitamente { skipTenant: true }', async () => {
    const res = await Factura.find({}, null, { skipTenant: true });
    expect(Array.isArray(res)).toBe(true);
  });

  it('impide que la Organización B lea, modifique o borre facturas o ingresos de la Organización A (responde 404)', async () => {
    let facturaA;
    let ingresoA;

    await runWithTenantContext({ tenantId: tenantA._id, userId: userA._id }, async () => {
      facturaA = await Factura.create({
        usuario: userA._id,
        tenantId: tenantA._id,
        fechaEmision: new Date(),
        emisor: { nombre: 'Proveedor A' },
        resumenFactura: { totalComprobante: 50000, totalImpuesto: 500 },
        estado: 'procesada',
      });

      ingresoA = await Ingreso.create({
        usuario: userA._id,
        tenantId: tenantA._id,
        fecha: new Date(),
        descripcion: 'Venta Ganado A',
        categoriaIngreso: 'venta_ganado_pie',
        montoSubtotal: 250000,
        montoTotal: 250000,
      });
    });

    // Organización B intenta leer la factura de A -> 404
    const getFacturaB = await request(app)
      .get(`/api/facturas/${facturaA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getFacturaB.status).toBe(404);

    // Organización B intenta borrar la factura de A -> 404
    const delFacturaB = await request(app)
      .delete(`/api/facturas/${facturaA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(delFacturaB.status).toBe(404);

    // Organización B intenta borrar el ingreso de A -> 404
    const delIngresoB = await request(app)
      .delete(`/api/ingresos/${ingresoA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(delIngresoB.status).toBe(404);

    // Verificar que los datos de A siguen intactos
    const sigueExistiendo = await Factura.findById(facturaA._id, null, { skipTenant: true });
    expect(sigueExistiendo).not.toBeNull();
  });

  it('ignora cualquier tenantId enviado en req.body al crear registros y fuerza el tenantId del JWT', async () => {
    const createRes = await request(app)
      .post('/api/ingresos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        fecha: new Date().toISOString(),
        descripcion: 'Intento Spoofing Tenant',
        categoriaIngreso: 'venta_leche',
        litrosVendidos: 100,
        precioUnitario: 1000,
        tenantId: tenantB._id.toString(),
      });

    expect(createRes.status).toBe(201);
    const creado = await Ingreso.findById(createRes.body._id, null, { skipTenant: true });
    expect(creado.tenantId.toString()).toBe(tenantA._id.toString());
    expect(creado.tenantId.toString()).not.toBe(tenantB._id.toString());
  });

  it('aísla el inventario multiespecie y los centros de costo entre tenants', async () => {
    const animal = await request(app)
      .post('/api/inventario/bovinos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tagId: 'A-001', sexo: 'hembra', tenantId: tenantB._id.toString() });
    expect(animal.status).toBe(201);

    const lote = await request(app)
      .post('/api/inventario/aves')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ loteId: 'AVES-A-001', especie: 'gallina_ponedora' });
    const estanque = await request(app)
      .post('/api/inventario/peces')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estanqueId: 'PECES-A-001', especie: 'tilapia' });
    const colmena = await request(app)
      .post('/api/inventario/colmenas')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ colmenaId: 'ABEJAS-A-001' });
    expect(lote.status).toBe(201);
    expect(estanque.status).toBe(201);
    expect(colmena.status).toBe(201);

    const inventarioA = await request(app)
      .get('/api/inventario')
      .set('Authorization', `Bearer ${tokenA}`);
    const inventarioB = await request(app)
      .get('/api/inventario')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(inventarioA.body.bovinos.map((b) => b.tagId)).toContain('A-001');
    expect(inventarioA.body.lotesAves.map((l) => l.loteId)).toContain('AVES-A-001');
    expect(inventarioA.body.estanques.map((e) => e.estanqueId)).toContain('PECES-A-001');
    expect(inventarioA.body.colmenas.map((c) => c.colmenaId)).toContain('ABEJAS-A-001');
    expect(inventarioB.body.bovinos.map((b) => b.tagId)).not.toContain('A-001');
    expect(inventarioB.body.lotesAves.map((l) => l.loteId)).not.toContain('AVES-A-001');
    expect(inventarioB.body.estanques.map((e) => e.estanqueId)).not.toContain('PECES-A-001');
    expect(inventarioB.body.colmenas.map((c) => c.colmenaId)).not.toContain('ABEJAS-A-001');

    const referenciaId = 'CENTRO-A-001';
    const centro = await request(app)
      .post('/api/costos/centros')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ referenciaId, tipoActividad: 'bovino_carne', nombreLote: 'Lote A' });
    expect(centro.status).toBe(201);

    const consumo = await request(app)
      .post(`/api/costos/centros/${referenciaId}/consumo`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipoInsumo: 'forraje', cantidad: 20, unidadMedida: 'kg', costoUnitario: 500 });
    expect(consumo.status).toBe(201);

    const produccion = await request(app)
      .post(`/api/costos/centros/${referenciaId}/produccion`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipoProducto: 'carne_bovino', cantidad: 10, unidadMedida: 'kg', ingresoBrutoVenta: 12000 });
    expect(produccion.status).toBe(201);

    const period = new Date().getFullYear();
    const resumenA = await request(app)
      .get(`/api/costos/resumen?periodoFiscal=${period}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const resumenB = await request(app)
      .get(`/api/costos/resumen?periodoFiscal=${period}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resumenA.body.centrosCosto.map((c) => c.referenciaId)).toContain(referenciaId);
    expect(resumenA.body.centrosCosto[0].indicadores.factorConversionAlimenticia).toBe(2);
    expect(resumenB.body.centrosCosto.map((c) => c.referenciaId)).not.toContain(referenciaId);
  });
});
