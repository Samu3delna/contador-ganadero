const request = require('supertest');
const express = require('express');
const Event = require('../models/IngestionEvent');
const inbox = require('../services/ingestionInbox');
const ingesta = require('../services/ingestaFacturaService');
const app = express(); app.use(express.json()); app.use('/email', require('../routes/emailWebhookRoutes'));
afterEach(() => jest.restoreAllMocks());
test('F-16: correo parcial conserva XML pendiente y reintenta sin repetir completados', async () => {
  const spy = jest.spyOn(ingesta, 'procesarFacturaXMLString')
    .mockResolvedValueOnce({ exito: true, claveNumerica: '1'.repeat(50) })
    .mockRejectedValueOnce(new Error('mongo temporal'))
    .mockResolvedValue({ exito: true, claveNumerica: '2'.repeat(50) });
  const xmlA = `<?xml version="1.0"?><FacturaElectronica><Clave>${'1'.repeat(50)}</Clave></FacturaElectronica>`;
  const xmlB = `<?xml version="1.0"?><FacturaElectronica><Clave>${'2'.repeat(50)}</Clave></FacturaElectronica>`;
  const rawEmail = `From: p@example.test\r\nTo: finca@example.test\r\nContent-Type: multipart/mixed; boundary=a\r\n\r\n--a\r\nContent-Type: text/xml\r\nContent-Disposition: attachment; filename="a.xml"\r\n\r\n${xmlA}\r\n--a\r\nContent-Type: text/xml\r\nContent-Disposition: attachment; filename="b.xml"\r\n\r\n${xmlB}\r\n--a--`;
  const response = await request(app).post('/email').send({ rawEmail });
  expect(response.status).toBe(202); expect(response.body.procesadas).toBe(1);
  expect(await Event.countDocuments({ estado: 'completado' })).toBe(1);
  const pending = await Event.findOne({ estado: 'pendiente' }); expect(pending.payload.xml).toContain('2'.repeat(50));
  await Event.updateOne({ _id: pending._id }, { $set: { claimHasta: new Date(0) } });
  await inbox.tick(); expect(spy).toHaveBeenCalledTimes(3); expect(await Event.countDocuments({ estado: 'completado' })).toBe(2);
});
test('F-16/F-17: claim expirado se recupera tras reinicio y dos workers no procesan simultaneamente', async () => {
  const spy = jest.spyOn(ingesta, 'procesarFacturaXMLString').mockResolvedValue({ exito: true });
  const event = await inbox.recibir({ eventKey: 'reinicio', canal: 'email', payload: { xml: 'synthetic', opciones: {} } });
  await Event.updateOne({ _id: event._id }, { $set: { estado: 'procesando', claimHasta: new Date(0), claimToken: 'proceso-muerto' } });
  await Promise.all([inbox.procesar(event._id), inbox.procesar(event._id)]);
  expect(spy).toHaveBeenCalledTimes(1); expect((await Event.findById(event._id)).estado).toBe('completado');
});
test('F-37: PDF de identidad incierta se conserva y no se adjunta al XML', async () => {
  const spy=jest.spyOn(ingesta,'procesarFacturaXMLString').mockResolvedValue({exito:true});
  const pdf=Buffer.from('%PDF-1.4 synthetic sin clave');
  const response=await request(app).post('/email').send({to:'finca@example.test',xml:`<FacturaElectronica><Clave>${'3'.repeat(50)}</Clave></FacturaElectronica>`,pdfBase64:pdf.toString('base64')});
  expect(response.status).toBe(200); expect(spy.mock.calls[0][1].pdfBuffer).toBeNull();
  const event=await Event.findOne({canal:'pdf_pendiente'}); expect(event.estado).toBe('sin_asignar'); expect(event.payload.buffer).toBeTruthy();
});
test('S-04/F-38: IMAP global utiliza inbox sin usuario arbitrario y conserva destinatario', async () => {
  const spy=jest.spyOn(ingesta,'procesarFacturaXMLString').mockResolvedValue({exito:true});
  const xml=`<FacturaElectronica><Clave>${'4'.repeat(50)}</Clave></FacturaElectronica>`;
  const source=Buffer.from(`From: p@example.test\r\nTo: destino@example.test\r\nContent-Type: multipart/mixed; boundary=a\r\n\r\n--a\r\nContent-Type: text/xml\r\nContent-Disposition: attachment; filename="a.xml"\r\n\r\n${xml}\r\n--a--`);
  await require('../services/emailService').procesarMensaje({source,uid:1},undefined);
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('4'.repeat(50)),expect.objectContaining({emailDestino:'destino@example.test',canal:'imap'}));
  expect(spy.mock.calls[0][1].usuarioId).toBeUndefined();
});
test('eventos pendientes del canal retirado quedan rechazados sin reintento', async () => {
  const event = await inbox.recibir({ eventKey: 'canal-retirado', canal: 'whatsapp', payload: { message: { id: 'histórico' } } });
  await inbox.procesar(event._id);
  expect((await Event.findById(event._id)).estado).toBe('rechazado');
});
