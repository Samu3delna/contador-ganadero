const worker = require('../../cloudflare-email-worker/worker').default;

function crearMensaje() {
  const raw = new Response('From: proveedor@example.cr\r\n\r\nFactura').body;
  return {
    from: 'proveedor@example.cr',
    to: 'finca-prueba@contadorganandero.com',
    raw,
    rawSize: 64,
    headers: new Headers(),
    setReject: jest.fn(),
  };
}

describe('Cloudflare Email Worker', () => {
  let fetchSpy;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('falla cerrado cuando falta el secreto del webhook', async () => {
    await expect(worker.email(crearMensaje(), {})).rejects.toThrow(/EMAIL_WEBHOOK_SECRET/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reintenta HTTP 5xx y termina cuando el backend acepta el correo', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await worker.email(crearMensaje(), { EMAIL_WEBHOOK_SECRET: 'secreto-de-prueba' });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][1].headers['X-Email-Webhook-Secret']).toBe('secreto-de-prueba');
  });

  it('no reintenta errores 4xx permanentes del backend', async () => {
    fetchSpy.mockResolvedValue(new Response('{"procesadas":0}', { status: 422 }));

    await expect(worker.email(crearMensaje(), { EMAIL_WEBHOOK_SECRET: 'secreto-de-prueba' })).rejects.toThrow(/HTTP 422/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
