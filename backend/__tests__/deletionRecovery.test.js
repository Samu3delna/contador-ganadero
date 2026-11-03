const request = require('supertest');
const app = require('../server');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');
const Solicitud = require('../models/SolicitudEliminacion');
const { ejecutarEliminacionDatos, reanudarEliminacion } = require('../controllers/dataDeletionController');
test('F-01: borrado parcial no informa completado y puede reanudarse idempotentemente', async () => {
  const u=await Usuario.create({nombre:'Borrar',email:'delete@example.test',password:'SyntheticPassword123!'});
  const t=await Tenant.crearParaUsuario({nombreFinca:'Eliminar',owner:u._id}); u.tenantId=t._id; await u.save();
  const spy=jest.spyOn(Factura,'deleteMany').mockRejectedValueOnce(new Error('fallo sintetico'));
  await expect(ejecutarEliminacionDatos({usuarioId:u._id,origen:'app_perfil'})).rejects.toMatchObject({status:503}); spy.mockRestore();
  const registro=await Solicitud.findOne({usuarioId:u._id});
  expect(registro.estado).toBe('fallida'); expect(registro.completadaEn).toBeUndefined(); expect(await Usuario.findById(u._id)).toBeTruthy();
  const done=await reanudarEliminacion(registro.codigoConfirmacion);
  expect(done.solicitud.estado).toBe('completada'); expect(await Usuario.findById(u._id)).toBeNull();
  expect((await reanudarEliminacion(registro.codigoConfirmacion)).solicitud.estado).toBe('completada');
});
test('F-01: codigo inventado devuelve 404 y fallo de consulta devuelve 503', async () => {
  const url='/api/webhooks/whatsapp/data-deletion/status/CODIGOINEXISTENTE';
  expect((await request(app).get(url)).status).toBe(404);
  const spy=jest.spyOn(Solicitud,'findOne').mockImplementationOnce(() => ({ lean: async () => { throw new Error('fallo sintetico'); } }));
  expect((await request(app).get(url)).status).toBe(503); spy.mockRestore();
});
test('solicitud publica sin titularidad no se puede reanudar como borrado', async () => {
  const s=await Solicitud.create({codigoConfirmacion:'PUBLICO-TEST',origen:'web_formulario',explicacionEstado:'Pendiente de titularidad'});
  await expect(reanudarEliminacion(s.codigoConfirmacion)).rejects.toThrow(/autorización/);
});
