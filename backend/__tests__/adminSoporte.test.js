/**
 * Tests para el módulo de soporte:
 *  - controllers/supportController.js (persistencia del formulario de contacto)
 *  - controllers/adminController.js   (bandeja de tickets del panel admin)
 *  - models/TicketSoporte.js
 *
 * El email real nunca se invoca: se stubbea `global.fetch` (usado por
 * enviarEmailCloudflare) o se dejan vacías las credenciales de Cloudflare.
 *
 * NOTA multi-tenant: todas las lecturas directas del modelo usan
 * { skipTenant: true } porque el tenantPlugin bloquea queries sin contexto.
 */

process.env.SUPER_ADMIN_EMAILS = 'admin@soporte.test';
delete process.env.CLOUDFLARE_EMAIL_API_TOKEN;
delete process.env.CLOUDFLARE_ACCOUNT_ID;

const TicketSoporte = require('../models/TicketSoporte');
const { enviarContactoSoporte } = require('../controllers/supportController');
const {
  listarTicketsSoporte,
  obtenerTicketSoporte,
  actualizarTicketSoporte,
  responderTicketSoporte,
} = require('../controllers/adminController');

/**
 * Ejecuta un handler con req/res/next mockeados y devuelve los mocks
 * para aserciones (incluye `next` porque los controladores lo usan en el catch).
 */
const llamar = async (handler, req) => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  const next = jest.fn();
  await handler(req, res, next);
  return { res, next };
};

const buildReqContacto = (overrides = {}) => ({
  body: {
    nombre: 'Ganadero Test',
    email: 'productor@finca.cr',
    asunto: 'Problema con facturas XML',
    mensaje: 'No me cargan las facturas electrónicas de Hacienda.',
    ...overrides,
  },
  get: () => 'Jest-Agent/1.0',
  ip: '127.0.0.1',
});

const crearTicket = (overrides = {}) => TicketSoporte.create({
  nombre: 'Ganadero Test',
  email: 'productor@finca.cr',
  asunto: 'Consulta general',
  mensajes: [{ autor: 'usuario', texto: 'Mensaje inicial' }],
  ...overrides,
});

// Lecturas de verificación SIEMPRE con skipTenant (plugin de aislamiento)
const leerTickets = () => TicketSoporte.find({}, null, { skipTenant: true }).lean();
const contarTickets = () => TicketSoporte.countDocuments({}, { skipTenant: true });
const leerTicket = (id) => TicketSoporte.findById(id, null, { skipTenant: true }).lean();

const fetchOk = () => jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, result: { id: 'msg_test_123' } }),
});

describe('Soporte: persistencia del formulario de contacto', () => {
  test('persiste el ticket aunque el envío de email falle (sin credenciales Cloudflare)', async () => {
    const { res, next } = await llamar(enviarContactoSoporte, buildReqContacto());

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));

    const tickets = await leerTickets();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].estado).toBe('abierto');
    expect(tickets[0].prioridad).toBe('media');
    expect(tickets[0].email).toBe('productor@finca.cr');
    expect(tickets[0].mensajes).toHaveLength(1);
    expect(tickets[0].mensajes[0].autor).toBe('usuario');
    expect(tickets[0].mensajes[0].emailEnviado).toBe(false);
    expect(tickets[0].mensajes[0].errorEnvio).toBeTruthy();
  });

  test('marca emailEnviado=true cuando la notificación a super admins tiene éxito', async () => {
    const fetchOriginal = global.fetch;
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = 'test_token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test_account';
    global.fetch = fetchOk();
    try {
      const { res } = await llamar(enviarContactoSoporte, buildReqContacto());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
      const tickets = await leerTickets();
      expect(tickets[0].mensajes[0].emailEnviado).toBe(true);
      expect(tickets[0].mensajes[0].errorEnvio).toBeNull();
    } finally {
      global.fetch = fetchOriginal;
      delete process.env.CLOUDFLARE_EMAIL_API_TOKEN;
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    }
  });

  test('rechaza con 400 si faltan campos y no crea ticket', async () => {
    const { res } = await llamar(enviarContactoSoporte, buildReqContacto({ email: '' }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(await contarTickets()).toBe(0);
  });
});

describe('Soporte: bandeja admin (listar / detalle / actualizar / responder)', () => {
  test('lista tickets con resumen por estado', async () => {
    await crearTicket({ asunto: 'Ticket A' });
    await crearTicket({ asunto: 'Ticket B', email: 'otro@finca.cr', estado: 'resuelto' });

    const { res, next } = await llamar(listarTicketsSoporte, { query: {}, params: {} });

    expect(next).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.total).toBe(2);
    expect(payload.tickets).toHaveLength(2);
    expect(payload.resumen).toEqual({ abierto: 1, resuelto: 1 });
  });

  test('filtra por estado, prioridad y búsqueda q; ignora valores inválidos', async () => {
    await crearTicket({ asunto: 'Factura no carga', email: 'a@finca.cr' });
    await crearTicket({ asunto: 'Duda D-150', email: 'b@finca.cr', estado: 'cerrado', prioridad: 'alta' });

    // Filtro por estado
    const resEstado = (await llamar(listarTicketsSoporte, { query: { estado: 'cerrado' }, params: {} })).res;
    expect(resEstado.json.mock.calls[0][0].total).toBe(1);
    expect(resEstado.json.mock.calls[0][0].tickets[0].asunto).toBe('Duda D-150');

    // Filtro por prioridad
    const resPrioridad = (await llamar(listarTicketsSoporte, { query: { prioridad: 'alta' }, params: {} })).res;
    expect(resPrioridad.json.mock.calls[0][0].total).toBe(1);

    // Búsqueda por email
    const resQ = (await llamar(listarTicketsSoporte, { query: { q: 'a@finca.cr' }, params: {} })).res;
    expect(resQ.json.mock.calls[0][0].total).toBe(1);
    expect(resQ.json.mock.calls[0][0].tickets[0].email).toBe('a@finca.cr');

    // Filtro con valor inválido se ignora (devuelve todos)
    const resInvalido = (await llamar(listarTicketsSoporte, { query: { estado: 'valor_malo' }, params: {} })).res;
    expect(resInvalido.json.mock.calls[0][0].total).toBe(2);
  });

  test('detalle devuelve 404 para id inexistente y 400 para id inválido', async () => {
    const { res: res404 } = await llamar(obtenerTicketSoporte, { params: { id: '5f8d0d55b54764421e7d0f0a' } });
    expect(res404.status).toHaveBeenCalledWith(404);

    const { res: res400 } = await llamar(obtenerTicketSoporte, { params: { id: 'no-es-un-id' } });
    expect(res400.status).toHaveBeenCalledWith(400);
  });

  test('actualiza estado y prioridad; rechaza valores inválidos', async () => {
    const ticket = await crearTicket();
    const id = ticket._id.toString();

    const { res: resOk } = await llamar(actualizarTicketSoporte, {
      params: { id },
      body: { estado: 'en_progreso', prioridad: 'alta' },
      usuario: { nombre: 'Admin Test', isSuperAdmin: true },
    });
    expect(resOk.status).not.toHaveBeenCalled();
    expect(resOk.json.mock.calls[0][0].ticket.estado).toBe('en_progreso');
    expect(resOk.json.mock.calls[0][0].ticket.prioridad).toBe('alta');

    const { res: resEstadoMalo } = await llamar(actualizarTicketSoporte, {
      params: { id },
      body: { estado: 'expirado' },
    });
    expect(resEstadoMalo.status).toHaveBeenCalledWith(400);

    const { res: resPrioridadMala } = await llamar(actualizarTicketSoporte, {
      params: { id },
      body: { prioridad: 'urgente' },
    });
    expect(resPrioridadMala.status).toHaveBeenCalledWith(400);

    const { res: resSinCambios } = await llamar(actualizarTicketSoporte, {
      params: { id },
      body: {},
    });
    expect(resSinCambios.status).toHaveBeenCalledWith(400);
  });

  test('responder agrega mensaje de soporte, envía email y pasa abierto a en_progreso', async () => {
    const fetchOriginal = global.fetch;
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = 'test_token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test_account';
    global.fetch = fetchOk();
    try {
      const ticket = await crearTicket({ estado: 'abierto' });

      const { res } = await llamar(responderTicketSoporte, {
        params: { id: ticket._id.toString() },
        body: { mensaje: 'Revisamos el caso y ya quedó resuelto. ¡Saludos!' },
        usuario: { nombre: 'Soporte Admin' },
      });

      expect(res.status).not.toHaveBeenCalled();
      const payload = res.json.mock.calls[0][0];
      expect(payload.ok).toBe(true);
      expect(payload.emailEnviado).toBe(true);

      const actualizado = await leerTicket(ticket._id);
      expect(actualizado.estado).toBe('en_progreso');
      expect(actualizado.mensajes).toHaveLength(2);
      const respuesta = actualizado.mensajes[1];
      expect(respuesta.autor).toBe('soporte');
      expect(respuesta.autorNombre).toBe('Soporte Admin');
      expect(respuesta.emailEnviado).toBe(true);
    } finally {
      global.fetch = fetchOriginal;
      delete process.env.CLOUDFLARE_EMAIL_API_TOKEN;
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    }
  });

  test('responder registra el mensaje aunque el email falle', async () => {
    // Sin credenciales de Cloudflare → enviarEmailCloudflare devuelve success:false sin red
    const ticket = await crearTicket({ estado: 'abierto' });

    const { res } = await llamar(responderTicketSoporte, {
      params: { id: ticket._id.toString() },
      body: { mensaje: 'Respuesta de diagnóstico' },
      usuario: { nombre: 'Soporte Admin' },
    });

    const payload = res.json.mock.calls[0][0];
    expect(payload.ok).toBe(true);
    expect(payload.emailEnviado).toBe(false);
    expect(payload.mensaje).toBeTruthy();

    const actualizado = await leerTicket(ticket._id);
    expect(actualizado.mensajes).toHaveLength(2);
    expect(actualizado.mensajes[1].emailEnviado).toBe(false);
    expect(actualizado.mensajes[1].errorEnvio).toBeTruthy();
    expect(actualizado.estado).toBe('en_progreso');
  });

  test('responder rechaza mensaje vacío o demasiado largo y no muta el ticket', async () => {
    const ticket = await crearTicket();

    const { res: resVacio } = await llamar(responderTicketSoporte, {
      params: { id: ticket._id.toString() },
      body: { mensaje: '   ' },
    });
    expect(resVacio.status).toHaveBeenCalledWith(400);

    const { res: resLargo } = await llamar(responderTicketSoporte, {
      params: { id: ticket._id.toString() },
      body: { mensaje: 'x'.repeat(5001) },
    });
    expect(resLargo.status).toHaveBeenCalledWith(400);

    expect(await contarTickets()).toBe(1);
    const sinCambios = await leerTicket(ticket._id);
    expect(sinCambios.mensajes).toHaveLength(1);
    expect(sinCambios.estado).toBe('abierto');
  });
});
