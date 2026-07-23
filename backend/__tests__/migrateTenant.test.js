/**
 * Tests para scripts/migrateTenant.js (backfill tenant)
 *
 * Estrategia:
 * - El script exporta `main` y solo se auto-ejecuta si es el modulo de
 *   entrada (require.main === module); bajo require() en tests NO se ejecuta.
 * - jest.setup.js ya conecta mongoose a MongoMemoryServer.
 * - Se mockea `config/db` para que conectarDB() sea no-op.
 * - Se mockea dotenv.config() para que no lea .env real.
 * - main() se invoca manualmente por test.
 */

const mongoose = require('mongoose');

const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');

jest.mock('../config/db', () => ({
  conectarDB: jest.fn().mockResolvedValue(),
}));

jest.mock('dotenv', () => ({
  config: jest.fn().mockReturnValue({ parsed: {} }),
}));

async function runMigration(dryRun) {
  const originalArgv = process.argv;
  process.argv = ['node', 'migrateTenant.js'];
  if (dryRun) process.argv.push('--dry-run');

  const closeMock = jest.spyOn(mongoose.connection, 'close').mockResolvedValue();
  const logMock = jest.spyOn(console, 'log').mockImplementation(() => {});
  const errorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

  // Re-require del script bajo modulo aislado para que拾 el argv nuevo
  let modulo;
  jest.isolateModules(() => {
    modulo = require('../scripts/migrateTenant');
  });

  const result = await modulo.main();

  closeMock.mockRestore();
  logMock.mockRestore();
  errorMock.mockRestore();
  process.argv = originalArgv;
  return result;
}

async function crearUsuario(email) {
  const u = new Usuario({
    nombre: email.split('@')[0],
    email,
    password: 'test-password-123',
    nombreFinca: 'Finca de ' + email,
  });
  await u.save();
  return u;
}

async function crearDocsSinTenant(usuarioId) {
  await Factura.insertMany([
    { usuario: usuarioId, fechaEmision: new Date('2026-01-01'), emisor: { nombre: 'Prov A' }, resumenFactura: { totalComprobante: 100 } },
    { usuario: usuarioId, fechaEmision: new Date('2026-02-01'), emisor: { nombre: 'Prov B' }, resumenFactura: { totalComprobante: 200 } },
    { usuario: usuarioId, fechaEmision: new Date('2026-03-01'), emisor: { nombre: 'Prov C' }, resumenFactura: { totalComprobante: 300 } },
  ]);
  await Ingreso.insertMany([
    { usuario: usuarioId, fecha: new Date('2026-01-05'), descripcion: 'Venta 1', montoSubtotal: 100, montoTotal: 100, categoriaIngreso: 'venta_ganado_pie' },
    { usuario: usuarioId, fecha: new Date('2026-02-05'), descripcion: 'Venta 2', montoSubtotal: 200, montoTotal: 200, categoriaIngreso: 'venta_ganado_pie' },
  ]);
}

describe('scripts/migrateTenant.js', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('(a) Modo --dry-run: no crea tenants ni modifica docs', async () => {
    const u1 = await crearUsuario('ana@finca.test');
    const u2 = await crearUsuario('bob@finca.test');

    await crearDocsSinTenant(u1._id);
    await crearDocsSinTenant(u2._id);

    await runMigration(true);

    const tenantsCount = await Tenant.countDocuments();
    expect(tenantsCount).toBe(0);

    const u1Post = await Usuario.findById(u1._id);
    const u2Post = await Usuario.findById(u2._id);
    expect(u1Post.tenantId).toBeFalsy();
    expect(u2Post.tenantId).toBeFalsy();

    const facturas = await Factura.find({ usuario: u1._id });
    expect(facturas.length).toBe(3);
    expect(facturas.every((f) => !f.tenantId)).toBe(true);

    const ingresos = await Ingreso.find({ usuario: u2._id });
    expect(ingresos.length).toBe(2);
    expect(ingresos.every((i) => !i.tenantId)).toBe(true);
  });

  test('(b) Sin dry-run: crea 2 tenants y propaga tenantId a docs', async () => {
    const u1 = await crearUsuario('carlos@finca.test');
    const u2 = await crearUsuario('dora@finca.test');

    await crearDocsSinTenant(u1._id);
    await crearDocsSinTenant(u2._id);

    await runMigration(false);

    const tenants = await Tenant.find({});
    expect(tenants.length).toBe(2);

    const u1Post = await Usuario.findById(u1._id);
    const u2Post = await Usuario.findById(u2._id);
    expect(u1Post.tenantId).toBeTruthy();
    expect(u2Post.tenantId).toBeTruthy();
    expect(u1Post.tenantId.toString()).not.toBe(u2Post.tenantId.toString());
    expect(u1Post.rol).toBe('dueño');
    expect(u2Post.rol).toBe('dueño');

    const facturasU1 = await Factura.find({ usuario: u1._id });
    expect(facturasU1.length).toBe(3);
    expect(
      facturasU1.every(
        (f) => f.tenantId && f.tenantId.toString() === u1Post.tenantId.toString()
      )
    ).toBe(true);

    const ingresosU1 = await Ingreso.find({ usuario: u1._id });
    expect(ingresosU1.length).toBe(2);
    expect(
      ingresosU1.every(
        (i) => i.tenantId && i.tenantId.toString() === u1Post.tenantId.toString()
      )
    ).toBe(true);

    const facturasU2 = await Factura.find({ usuario: u2._id });
    expect(
      facturasU2.every(
        (f) => f.tenantId && f.tenantId.toString() === u2Post.tenantId.toString()
      )
    ).toBe(true);
  });

  test('(c) Idempotencia: segunda corrida no crea tenants ni modifica docs', async () => {
    const u1 = await crearUsuario('eduardo@finca.test');
    const u2 = await crearUsuario('flor@finca.test');

    await crearDocsSinTenant(u1._id);
    await crearDocsSinTenant(u2._id);

    await runMigration(false);

    const tenantsCountPrimero = await Tenant.countDocuments();
    const docsMigradosPrimero = await Factura.countDocuments({
      tenantId: { $exists: true, $ne: null },
    });
    expect(tenantsCountPrimero).toBe(2);
    expect(docsMigradosPrimero).toBe(6);

    const u1DespuesPrimero = await Usuario.findById(u1._id);
    const tenantIdU1Antes = u1DespuesPrimero.tenantId.toString();

    // Segunda corrida
    await runMigration(false);

    const tenantsCountSegundo = await Tenant.countDocuments();
    expect(tenantsCountSegundo).toBe(2);

    const u1DespuesSegundo = await Usuario.findById(u1._id);
    expect(u1DespuesSegundo.tenantId.toString()).toBe(tenantIdU1Antes);
    expect(u1DespuesSegundo.rol).toBe('dueño');
  });
});
