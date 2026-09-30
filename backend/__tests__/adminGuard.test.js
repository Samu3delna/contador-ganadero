/**
 * Tests para middleware/adminGuard.js
 * Valida la detección estricta de administradores y el bloqueo a usuarios normales.
 */

const { esSuperAdmin, esEmailSuperAdmin } = require('../middleware/adminGuard');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('middleware/adminGuard - esEmailSuperAdmin', () => {
  test('debe reconocer admin@admin.admin como super admin', () => {
    expect(esEmailSuperAdmin('admin@admin.admin')).toBe(true);
    expect(esEmailSuperAdmin('ADMIN@ADMIN.ADMIN')).toBe(true);
  });

  test('no debe reconocer usuarios normales o personales como super admin', () => {
    expect(esEmailSuperAdmin('samu3delgado@gmail.com')).toBe(false);
    expect(esEmailSuperAdmin('usuario@finca.cr')).toBe(false);
    expect(esEmailSuperAdmin('ganadero@demo.com')).toBe(false);
    expect(esEmailSuperAdmin('')).toBe(false);
    expect(esEmailSuperAdmin(undefined)).toBe(false);
  });
});

describe('middleware/adminGuard - esSuperAdmin middleware', () => {
  beforeEach(() => {
    mockNext.mockClear();
  });

  test('permite acceso si el email es admin@admin.admin', () => {
    const req = { usuario: { email: 'admin@admin.admin', rol: 'dueño' } };
    const res = mockRes();

    esSuperAdmin(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('permite acceso si el usuario tiene rol admin o administrador', () => {
    const req1 = { usuario: { email: 'otro@test.com', rol: 'admin' } };
    const res1 = mockRes();
    esSuperAdmin(req1, res1, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    mockNext.mockClear();
    const req2 = { usuario: { email: 'otro@test.com', rol: 'administrador' } };
    const res2 = mockRes();
    esSuperAdmin(req2, res2, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  test('permite acceso si tiene isSuperAdmin o esSuperAdmin en true', () => {
    const req = { usuario: { email: 'custom@empresa.com', isSuperAdmin: true, rol: 'dueño' } };
    const res = mockRes();

    esSuperAdmin(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  test('rechaza con 403 NO_SUPER_ADMIN a usuario normal o con plan regular', () => {
    const req = { usuario: { email: 'samu3delgado@gmail.com', rol: 'dueño', isSuperAdmin: false } };
    const res = mockRes();

    esSuperAdmin(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'NO_SUPER_ADMIN' });
  });

  test('rechaza con 403 NO_SUPER_ADMIN a peón o contador con email común', () => {
    const req = { usuario: { email: 'contador@agro.cr', rol: 'contador' } };
    const res = mockRes();

    esSuperAdmin(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
