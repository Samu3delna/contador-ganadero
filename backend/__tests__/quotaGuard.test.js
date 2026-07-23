/**
 * Tests para middleware/quotaGuard.js
 */

const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const {
  requiereTenantActivo,
  requiereCreditoConteo,
  requiereCreditoChat,
  requiereFeatureVLM,
  requiereFeatureModuloContable,
} = require('../middleware/quotaGuard');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

const buildTenantMock = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  plan: 'oro',
  estado: 'activo',
  limites: {
    conteosMes: 5,
    usuariosTenant: 1,
    almacenamientoMB: 100,
    vlmHabilitado: true,
    tokensChatMes: 1000000,
    moduloContable: true,
  },
  consumoActual: {
    conteosMes: 0,
    tokensChatMes: 0,
    almacenamientoUsadoMB: 0,
    periodoActual: '2026-07',
  },
  estaActivo: function () {
    return ['activo', 'periodo_gracia'].includes(this.estado);
  },
  tieneCreditoConteo: function () {
    return this.estado === 'activo' &&
      (this.consumoActual?.conteosMes || 0) < (this.limites?.conteosMes || 0);
  },
  tieneCreditoChat: function () {
    if (this.estado === 'cancelado') return false;
    if (this.estado === 'suspendido') return false;
    return (this.consumoActual?.tokensChatMes || 0) < (this.limites?.tokensChatMes || 0);
  },
  ...overrides,
});

const mockReq = (tenant) => ({ tenant });

beforeEach(() => {
  mockNext.mockClear();
});

describe('middleware/quotaGuard - requiereTenantActivo', () => {
  test('tenant activo -> next()', () => {
    const req = mockReq(buildTenantMock({ estado: 'activo' }));
    const res = mockRes();

    requiereTenantActivo(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('tenant suspendido -> 402 TENANT_INACTIVO', () => {
    const req = mockReq(buildTenantMock({ estado: 'suspendido' }));
    const res = mockRes();

    requiereTenantActivo(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'TENANT_INACTIVO' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('tenant periodo_gracia -> next() (acceso permitido)', () => {
    const req = mockReq(buildTenantMock({ estado: 'periodo_gracia' }));
    const res = mockRes();

    requiereTenantActivo(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('middleware/quotaGuard - requiereCreditoConteo', () => {
  test('consumo 3 < limite 5 -> next()', () => {
    const req = mockReq(buildTenantMock({
      consumoActual: { conteosMes: 3 },
    }));
    const res = mockRes();

    requiereCreditoConteo(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('consumo 5 >= limite 5 -> 429 CUOTA_CONTEOS_AGOTADA', () => {
    const req = mockReq(buildTenantMock({
      consumoActual: { conteosMes: 5 },
    }));
    const res = mockRes();

    requiereCreditoConteo(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'CUOTA_CONTEOS_AGOTADA' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('consumo 7 > limite 5 -> 429', () => {
    const req = mockReq(buildTenantMock({
      consumoActual: { conteosMes: 7 },
    }));
    const res = mockRes();

    requiereCreditoConteo(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('middleware/quotaGuard - requiereCreditoChat', () => {
  test('consumo 500000 < limite 1000000 -> next()', () => {
    const req = mockReq(buildTenantMock({
      consumoActual: { tokensChatMes: 500000 },
    }));
    const res = mockRes();

    requiereCreditoChat(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('consumo >= limite -> 429 CUOTA_CHAT_AGOTADA', () => {
    const req = mockReq(buildTenantMock({
      consumoActual: { tokensChatMes: 1000000 },
    }));
    const res = mockRes();

    requiereCreditoChat(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'CUOTA_CHAT_AGOTADA' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('middleware/quotaGuard - requiereFeatureVLM', () => {
  test('vlmHabilitado true -> next()', () => {
    const req = mockReq(buildTenantMock({
      limites: { vlmHabilitado: true },
    }));
    const res = mockRes();

    requiereFeatureVLM(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('vlmHabilitado false -> 403 PLAN_SIN_VLM', () => {
    const req = mockReq(buildTenantMock({
      limites: { vlmHabilitado: false },
    }));
    const res = mockRes();

    requiereFeatureVLM(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'PLAN_SIN_VLM' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('middleware/quotaGuard - requiereFeatureModuloContable', () => {
  test('moduloContable true -> next()', () => {
    const req = mockReq(buildTenantMock({
      limites: { moduloContable: true },
    }));
    const res = mockRes();

    requiereFeatureModuloContable(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('moduloContable false -> 403 PLAN_SIN_ACCESO_MODULO', () => {
    const req = mockReq(buildTenantMock({
      limites: { moduloContable: false },
    }));
    const res = mockRes();

    requiereFeatureModuloContable(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'PLAN_SIN_ACCESO_MODULO' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('middleware/quotaGuard - sin tenant', () => {
  test('req.tenant undefined -> requiereTenantActivo 402', () => {
    const req = { tenant: undefined };
    const res = mockRes();

    requiereTenantActivo(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(402);
  });

  test('req.tenant undefined -> requiereCreditoConteo 429', () => {
    const req = { tenant: undefined };
    const res = mockRes();

    requiereCreditoConteo(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(429);
  });
});
