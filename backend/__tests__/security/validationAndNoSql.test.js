const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Usuario = require('../../models/Usuario');
const Tenant = require('../../models/Tenant');
const { parsearFacturaXML } = require('../../services/xmlParserService');
const { generarCSV } = require('../../services/declaracionService');

describe('Bloque 3, 10 y 11: Validación Estricta, Inyección NoSQL, Asignación Masiva, Límite de Body, XXE y CSV Injection', () => {
  let ownerUser;
  let ownerTenant;
  let ownerToken;

  beforeEach(async () => {
    ownerUser = await Usuario.create({
      nombre: 'Productor Seguro',
      email: 'seguro@finca.cr',
      password: 'PasswordFuerte123!',
      cedula: '101110111',
      rol: 'owner',
    });
    ownerTenant = await Tenant.crearParaUsuario({
      nombreFinca: 'Finca Segura',
      owner: ownerUser._id,
      plan: 'free',
    });
    ownerUser.tenantId = ownerTenant._id;
    await ownerUser.save();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'seguro@finca.cr', password: 'PasswordFuerte123!' });
    ownerToken = loginRes.body.token;
  });

  it('rechaza con 400 el intento de inyección NoSQL en login: {"email":{"$ne":null},"password":{"$ne":null}}', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });

    expect(res.status).toBe(400);
  });

  it('enviar rol, tenantId, plan o isSuperAdmin en un alta o edición NO los modifica', async () => {
    const fakeTenantId = new mongoose.Types.ObjectId();

    // 1. Intento de inyectar rol/tenantId/plan/isSuperAdmin en registro
    const regRes = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Intruso',
        email: 'intruso@finca.cr',
        password: 'PasswordFuerte123!',
        cedula: '102220333',
        aceptaTerminos: true,
        rol: 'superadmin',
        tenantId: fakeTenantId.toString(),
        plan: 'pro',
        isSuperAdmin: true,
      });

    expect(regRes.status).toBe(201);
    const nuevoUsuario = await Usuario.findOne({ email: 'intruso@finca.cr' });
    expect(nuevoUsuario.rol).toBe('dueño');
    expect(nuevoUsuario.isSuperAdmin).toBe(false);
    expect(nuevoUsuario.tenantId.toString()).not.toBe(fakeTenantId.toString());

    // 2. Intento de inyectar rol/tenantId/isSuperAdmin en edición de perfil
    const resPerfil = await request(app)
      .put('/api/auth/perfil')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nombre: 'Nombre Actualizado',
        rol: 'superadmin',
        tenantId: fakeTenantId.toString(),
        isSuperAdmin: true,
        esSuperAdmin: true,
      });

    expect([200, 400]).toContain(resPerfil.status);

    const recargado = await Usuario.findById(ownerUser._id);
    expect(recargado.isSuperAdmin).toBe(false);
    expect(recargado.esSuperAdmin).toBe(false);
    expect(recargado.rol).toBe('owner');
    expect(recargado.tenantId.toString()).toBe(ownerTenant._id.toString());
  });

  it('rechaza con 413 un body JSON mayor a 100kb', async () => {
    const payloadGigante = {
      email: 'seguro@finca.cr',
      password: 'A'.repeat(120 * 1024),
    };

    const res = await request(app)
      .post('/api/auth/login')
      .send(payloadGigante);

    expect(res.status).toBe(413);
  });

  it('rechaza XML con declaraciones DOCTYPE / ENTITY (protección XXE)', () => {
    const maliciousXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<FacturaElectronica><Clave>&xxe;</Clave></FacturaElectronica>`;

    expect(() => parsearFacturaXML(maliciousXml)).toThrow(/DOCTYPE|XXE/i);
  });

  it('neutraliza fórmulas peligrosas (=, +, -, @) en exportaciones CSV manteniendo intactas las claves numéricas', () => {
    const csv = generarCSV([
      {
        tipo: 'GASTO',
        fecha: '2026-03-01',
        proveedor: "=cmd|' /C calc'!A0",
        cedulaProveedor: '3101123456',
        descripcion: '+SUM(A1:A10)',
        categoria: '@malicious',
        subtotal: 1000,
        iva: 10,
        total: 1010,
        consecutivo: '00100001010000000001',
        claveNumerica: '50601032600310112345600100001010000000001123456789',
        numComprobante: '00100001010000000001',
        esDeducible: 'Sí',
        motivoNoDeducible: '-riesgo',
        tasaIVA: 1,
      },
    ]);

    expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
    expect(csv).toContain('"\'+SUM(A1:A10)"');
    expect(csv).toContain('="50601032600310112345600100001010000000001123456789"');
  });
});
