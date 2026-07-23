/**
 * Tests para middleware/tenantGuard.js (extraerTenant)
 */

const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const { extraerTenant } = require('../middleware/tenantGuard');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

const mockReq = (overrides = {}) => ({
  usuario: { tenantId: new mongoose.Types.ObjectId() },
  ...overrides,
});

describe('middleware/tenantGuard - extraerTenant', () => {
  beforeEach(() => {
    mockNext.mockClear();
  });

  test('(a) SIN tenantId en req.usuario -> 401 SIN_TENANT', async () => {
    const req = mockReq({ usuario: {} });
    const res = mockRes();

    await extraerTenant(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'SIN_TENANT' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('(b) tenantId valido pero Tenant no existe -> 401 TENANT_INVALIDO', async () => {
    const req = mockReq({ usuario: { tenantId: new mongoose.Types.ObjectId() } });
    const res = mockRes();

    await extraerTenant(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'TENANT_INVALIDO' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('(c) Tenant suspendido -> 402 SUSCRIPCION_SUSPENDIDA', async () => {
    const suspendido = await Tenant.create({
      nombreFinca: 'Finca Suspendida',
      plan: 'bronce',
      estado: 'suspendido',
      limites: Tenant.obtenerLimitesPlan('bronce'),
    });

    const req = mockReq({ usuario: { tenantId: suspendido._id } });
    const res = mockRes();

    await extraerTenant(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'SUSCRIPCION_SUSPENDIDA' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('(d) Tenant cancelado -> 402 SUSCRIPCION_CANCELADA', async () => {
    const cancelado = await Tenant.create({
      nombreFinca: 'Finca Cancelada',
      plan: 'free',
      estado: 'cancelado',
      limites: Tenant.obtenerLimitesPlan('free'),
    });

    const req = mockReq({ usuario: { tenantId: cancelado._id } });
    const res = mockRes();

    await extraerTenant(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'SUSCRIPCION_CANCELADA' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('(e) Tenant activo -> next(), req.tenant, filtrarPorTenant y aplicarTenant', async () => {
    const activo = await Tenant.create({
      nombreFinca: 'Finca Activa',
      plan: 'oro',
      estado: 'activo',
      limites: Tenant.obtenerLimitesPlan('oro'),
    });

    const req = mockReq({ usuario: { tenantId: activo._id } });
    const res = mockRes();

    await extraerTenant(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.tenant).toBeDefined();
    expect(req.tenant._id.toString()).toBe(activo._id.toString());

    const filtro = req.filtrarPorTenant({ foo: 'bar' });
    expect(filtro).toEqual({ tenantId: activo._id, foo: 'bar' });

    const doc = { nombre: 'algo' };
    const result = req.aplicarTenant(doc);
    expect(result.tenantId.toString()).toBe(activo._id.toString());
    expect(result).toBe(doc);
  });

  test('(f) Tenant periodo_gracia -> next() acceso permitido', async () => {
    const gracia = await Tenant.create({
      nombreFinca: 'Finca en Gracia',
      plan: 'oro',
      estado: 'periodo_gracia',
      limites: Tenant.obtenerLimitesPlan('oro'),
    });

    const req = mockReq({ usuario: { tenantId: gracia._id } });
    const res = mockRes();

    await extraerTenant(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.tenant).toBeDefined();
    expect(req.tenant.estado).toBe('periodo_gracia');
  });
});
