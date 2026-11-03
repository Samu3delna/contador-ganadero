const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { simpleParser } = require('mailparser');
const { extraerContenidoFactura } = require('../services/emailAttachments');
const { MiB, limiteAdjunto } = require('../utils/limitedZip');
const inbox = require('../services/ingestionInbox');

/**
 * Middleware para autenticar el webhook con un secreto compartido en cabecera
 */
function verificarSecreto(req, res, next) {
  const secretEsperado = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secretEsperado) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Webhook de email no configurado' });
    }
    return next();
  }

  // Solo aceptar secreto por cabecera (nunca en query string para no exponerlo en logs)
  const secretRecibido = req.headers['x-email-webhook-secret'];
  if (!secretRecibido || typeof secretRecibido !== 'string') {
    return res.status(401).json({ error: 'No autorizado: secreto de webhook inválido' });
  }

  const bufA = Buffer.from(secretRecibido);
  const bufB = Buffer.from(secretEsperado);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return res.status(401).json({ error: 'No autorizado: secreto de webhook inválido' });
  }
  next();
}

/**
 * Extrae la dirección de email limpia desde strings tipo '"Nombre" <correo@dominio.com>'
 */
function extraerEmailLimpio(texto) {
  if (!texto) return '';
  const match = String(texto).match(/<([^>]+)>/) || String(texto).match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (match) return match[1].toLowerCase().trim();
  return String(texto).toLowerCase().trim();
}

/**
 * Extrae de forma recursiva todos los XMLs y PDFs de un correo (adjuntos directos, .eml, .zip, inline)
 */
/**
 * POST /api/webhooks/email
 * Recibe correos entrantes reenviados por Cloudflare Email Routing / Worker
 */
router.post(
  '/',
  verificarSecreto,
  express.raw({ type: () => true, limit: '10mb' }),
  async (req, res) => {
    try {
      let rawTo = req.headers['x-email-to'] || '';
      let rawFrom = req.headers['x-email-from'] || '';
      let xmlsParaProcesar = [];
      let pdfBuffer = null;
      let pdfs = [];

      if (req.is('json') && req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        rawTo = req.body.to || rawTo;
        rawFrom = req.body.from || rawFrom;

        if (req.body.xmlBase64) {
          xmlsParaProcesar.push(Buffer.from(req.body.xmlBase64, 'base64').toString('utf-8'));
        } else if (req.body.xml) {
          xmlsParaProcesar.push(req.body.xml);
        }

        if (req.body.pdfBase64) {
          pdfBuffer = Buffer.from(req.body.pdfBase64, 'base64');
          pdfs = [{ nombre: '', buffer: pdfBuffer }];
        }

        if (req.body.rawEmail && xmlsParaProcesar.length === 0) {
          const parsed = await simpleParser(req.body.rawEmail);
          const extraido = await extraerContenidoFactura(parsed);
          xmlsParaProcesar = extraido.xmls;
          pdfBuffer = extraido.pdfBuffer || pdfBuffer;
          pdfs = extraido.pdfs;
        }
      } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        const parsed = await simpleParser(req.body);
        rawTo = rawTo || parsed.to?.text || '';
        rawFrom = rawFrom || parsed.from?.text || '';

        const extraido = await extraerContenidoFactura(parsed);
        xmlsParaProcesar = extraido.xmls;
        pdfBuffer = extraido.pdfBuffer;
        pdfs = extraido.pdfs;
      }

      const toLimpio = extraerEmailLimpio(rawTo);
      const fromLimpio = extraerEmailLimpio(rawFrom);
      // Keep every PDF even when its identity cannot be proved. Never attach a
      // single arbitrary PDF to several XMLs or to a different tenant's invoice.
      for (const pdf of pdfs) {
        await inbox.recibir({ eventKey: `pdf:${toLimpio}:${inbox.hash(pdf.buffer)}`, canal: 'pdf_pendiente',
          estado: 'sin_asignar', payload: { emailDestino: toLimpio, nombre: pdf.nombre, buffer: pdf.buffer } });
      }

      if (xmlsParaProcesar.length === 0) {
        return res.status(200).json({
          recibido: true,
          procesadas: 0,
          mensaje: 'Email recibido pero no contenía archivos XML de factura electrónica adjuntos.',
        });
      }

      const resultados = [];
      for (const xml of xmlsParaProcesar) {
        if (typeof xml !== 'string' || Buffer.byteLength(xml) > 2 * MiB) throw limiteAdjunto();
        const clave = xml.match(/<(?:\w+:)?Clave>\s*(\d{50})\s*<\//)?.[1];
        const candidates = clave ? pdfs.filter(p => p.nombre.includes(clave) || p.buffer.includes(Buffer.from(clave))) : [];
        const evento = await inbox.recibir({ eventKey: `email:${toLimpio}:${inbox.hash(xml)}`, canal: 'email',
          payload: { xml, pdfBuffer: candidates.length === 1 ? candidates[0].buffer : null,
            opciones: { emailDestino: toLimpio, canal: 'cloudflare-email' } } });
        const completed = await inbox.procesar(evento._id);
        resultados.push(completed.resultado ? { ...completed.resultado, ...(evento.estado === 'completado' ? { duplicada: true } : {}) }
          : { exito: false, pendiente: true, mensaje: 'Evento guardado; procesamiento pendiente' });
      }

      const exitoCount = resultados.filter(r => r.exito).length;
      const detalles = resultados.map((resultado) => ({
        exito: Boolean(resultado.exito),
        duplicada: Boolean(resultado.duplicada),
        actualizada: Boolean(resultado.actualizada),
        noAsignada: Boolean(resultado.noAsignada),
        claveNumerica: resultado.claveNumerica || resultado.factura?.claveNumerica,
        emisor: resultado.emisor,
        total: resultado.total,
        alertas: resultado.alertas,
        mensaje: resultado.mensaje,
        error: resultado.error,
      }));
      const mensajeResumen = exitoCount > 0
        ? `✅ ${exitoCount} factura(s) guardada(s) con éxito`
        : `⚠️ 0 facturas guardadas: ${resultados[0]?.mensaje || resultados[0]?.error || 'No se pudo procesar el XML'}`;

      const status = resultados.some(r => r.pendiente) ? 202 : exitoCount === 0 ? 422 : exitoCount < resultados.length ? 207 : 200;
      return res.status(status).json({
        resumen: mensajeResumen,
        procesadas: exitoCount,
        recibido: true,
        pendientes: resultados.filter(r => r.pendiente).length,
        remitente: fromLimpio,
        destinatario: toLimpio,
        detalles,
      });
    } catch (error) {
      if (error.code === 'LIMITE_ADJUNTOS') return res.status(413).json({ error: 'LIMITE_ADJUNTOS' });
      console.error('❌ Error general en Webhook Email:', error);
      return res.status(500).json({ error: 'Error procesando webhook de correo' });
    }
  }
);

module.exports = router;
