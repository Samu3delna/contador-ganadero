/**
 * Tests para middleware/adminGuard.js
 * Valida la separación estricta entre rol de tenant (dueño/admin) y Super Admin de plataforma (isSuperAdmin === true),
 * así como la eliminación de 'admin@admin.admin'.
 */

const { esSuperAdmin, esEmailSuperAdmin, esDueñoTenant } = require('../middleware/adminGuard');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('middleware/adminGuard - esEmailSuperAdmin', () => {
  test('NO debe reconocer admin@admin.admin por defecto como super admin', () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(esEmailSuperAdmin('admin@admin.admin')).toBe(false);
    expect(esEmailSuperAdmin('ADMIN@ADMIN.ADMIN')).toBe(false);
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

  test('rechaza acceso si el email es admin@admin.admin pero isSuperAdmin no es true', () => {
    const req = { usuario: { email: 'admin@admin.admin', rol: 'dueño', isSuperAdmin: false } };
    const res = mockRes();

    esSuperAdmin(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'NO_SUPER_ADMIN' });
  });

  test('rechaza acceso si el usuario solo tiene rol admin de tenant pero no isSuperAdmin', () => {
    const req1 = { usuario: { email: 'otro@test.com', rol: 'admin', isSuperAdmin: false } };
    const res1 = mockRes();
    esSuperAdmin(req1, res1, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
    expect(res1.status).toHaveBeenCalledWith(403);
  });

  test('permite acceso únicamente si tiene isSuperAdmin o esSuperAdmin en true', () => {
    const req = { usuario: { email: 'custom@empresa.com', isSuperAdmin: true, rol: 'dueño' } };
    const res = mockRes();

    esSuperAdmin(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
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

describe('middleware/adminGuard - esDueñoTenant middleware', () => {
  beforeEach(() => {
    mockNext.mockClear();
  });

  test('permite acceso a rol dueño o admin de tenant', () => {
    const res = mockRes();
    esDueñoTenant({ usuario: { rol: 'dueño' } }, res, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    mockNext.mockClear();
    esDueñoTenant({ usuario: { rol: 'admin' } }, res, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  test('rechaza acceso a contador o peon', () => {
    const res = mockRes();
    esDueñoTenant({ usuario: { rol: 'peon' } }, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
