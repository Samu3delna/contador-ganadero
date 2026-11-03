const JSZip = require('jszip');
const { leerEntrada, MiB } = require('../utils/limitedZip');
const request = require('supertest');
const express = require('express');
const app = express();
app.use('/email', require('../routes/emailWebhookRoutes'));
test('F-18: lectura ZIP interrumpe descompresion al superar limite por entrada', async () => {
  const zip = new JSZip(); zip.file('grande.xml', 'x'.repeat(3 * MiB));
  const data = await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  expect(data.length).toBeLessThan(10000);
  const parsed = await JSZip.loadAsync(data);
  const presupuesto = {bytes:0};
  await expect(leerEntrada(parsed.file('grande.xml'),2*MiB,presupuesto)).rejects.toMatchObject({code:'LIMITE_ADJUNTOS'});
  expect(presupuesto.bytes).toBeLessThan(3*MiB);
});
test('F-18: webhook devuelve 413 en vez de confirmar un ZIP sobredimensionado', async () => {
  const zip = new JSZip(); zip.file('grande.xml','x'.repeat(3*MiB));
  const data=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  const mime = `From: proveedor@example.test\r\nTo: finca@example.test\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=testboundary\r\n\r\n--testboundary\r\nContent-Type: application/zip\r\nContent-Disposition: attachment; filename="facturas.zip"\r\nContent-Transfer-Encoding: base64\r\n\r\n${data.toString('base64')}\r\n--testboundary--\r\n`;
  const response=await request(app).post('/email').set('Content-Type','message/rfc822').send(mime);
  expect(response.status).toBe(413);
});
