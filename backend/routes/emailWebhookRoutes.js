const express = require('express');
const router = express.Router();
const { simpleParser } = require('mailparser');
const { procesarFacturaXMLString } = require('../services/ingestaFacturaService');

/**
 * Middleware para autenticar el webhook con un secreto compartido
 */
function verificarSecreto(req, res, next) {
  const secretEsperado = process.env.EMAIL_WEBHOOK_SECRET;
  // Si no está configurado en dev, permitir; en prod advertir o validar
  if (!secretEsperado) {
    return next();
  }

  const secretRecibido = req.headers['x-email-webhook-secret'] || req.query.secret;
  if (!secretRecibido || secretRecibido !== secretEsperado) {
    return res.status(401).json({ error: 'No autorizado: secreto de webhook inválido' });
  }
  next();
}

/**
 * POST /api/webhooks/email
 * Recibe correos entrantes reenviados por Cloudflare Email Routing / Worker
 */
router.post('/', verificarSecreto, express.raw({ type: ['message/rfc822', 'application/octet-stream', 'text/plain'], limit: '25mb' }), async (req, res) => {
  try {
    let to = req.headers['x-email-to'] || '';
    let from = req.headers['x-email-from'] || '';
    let xmlsParaProcesar = [];
    let pdfBuffer = null;

    // Caso 1: Payload JSON (ej: enviado desde un worker que parseó o adjuntó en base64)
    if (req.is('json') && req.body) {
      to = req.body.to || to;
      from = req.body.from || from;

      if (req.body.xmlBase64) {
        xmlsParaProcesar.push(Buffer.from(req.body.xmlBase64, 'base64').toString('utf-8'));
      } else if (req.body.xml) {
        xmlsParaProcesar.push(req.body.xml);
      }

      if (req.body.pdfBase64) {
        pdfBuffer = Buffer.from(req.body.pdfBase64, 'base64');
      }

      // Si venía el MIME crudo en el JSON
      if (req.body.rawEmail && xmlsParaProcesar.length === 0) {
        const parsed = await simpleParser(req.body.rawEmail);
        for (const adjunto of (parsed.attachments || [])) {
          const nombre = (adjunto.filename || '').toLowerCase();
          if (nombre.endsWith('.xml')) xmlsParaProcesar.push(adjunto.content.toString('utf-8'));
          if (nombre.endsWith('.pdf')) pdfBuffer = adjunto.content;
        }
      }
    } 
    // Caso 2: Stream RFC822 crudo enviado directamente por el worker
    else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      const parsed = await simpleParser(req.body);
      to = to || parsed.to?.text || '';
      from = from || parsed.from?.text || '';

      for (const adjunto of (parsed.attachments || [])) {
        const nombre = (adjunto.filename || '').toLowerCase();
        if (nombre.endsWith('.xml')) {
          xmlsParaProcesar.push(adjunto.content.toString('utf-8'));
        }
        if (nombre.endsWith('.pdf')) {
          pdfBuffer = adjunto.content;
        }
      }

      // Si el XML vino embebido en el HTML
      if (xmlsParaProcesar.length === 0 && parsed.html) {
        const xmlRegex = /<\?xml[\s\S]*?<\/(?:FacturaElectronica|NotaCreditoElectronica|TiqueteElectronico)>/gi;
        const matches = parsed.html.match(xmlRegex);
        if (matches) xmlsParaProcesar.push(...matches);
      }
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
      try {
        const resultado = await procesarFacturaXMLString(xml, {
          emailDestino: to,
          pdfBuffer,
          canal: 'cloudflare-email',
        });
        resultados.push(resultado);
      } catch (err) {
        console.error('❌ Error procesando XML desde email:', err.message);
        resultados.push({ exito: false, error: err.message });
      }
    }

    return res.status(200).json({
      recibido: true,
      remitente: from,
      destinatario: to,
      procesadas: resultados.filter(r => r.exito).length,
      detalles: resultados,
    });
  } catch (error) {
    console.error('❌ Error general en Webhook Email:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
