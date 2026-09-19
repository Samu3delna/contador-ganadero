const express = require('express');
const router = express.Router();
const { simpleParser } = require('mailparser');
const JSZip = require('jszip');
const { procesarFacturaXMLString } = require('../services/ingestaFacturaService');

/**
 * Middleware para autenticar el webhook con un secreto compartido (opcional)
 */
function verificarSecreto(req, res, next) {
  const secretEsperado = process.env.EMAIL_WEBHOOK_SECRET;
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
async function extraerContenidoFactura(parsed) {
  const xmls = [];
  let pdfBuffer = null;

  async function procesarAdjunto(adjunto) {
    if (!adjunto || !adjunto.content) return;
    const nombre = (adjunto.filename || '').toLowerCase();
    const ctype = (adjunto.contentType || '').toLowerCase();
    const content = adjunto.content;

    // 1. Archivos XML directos
    if (nombre.endsWith('.xml') || ctype.includes('xml')) {
      xmls.push(content.toString('utf-8'));
      return;
    }

    // 2. Archivos PDF directos
    if (nombre.endsWith('.pdf') || ctype.includes('pdf')) {
      if (!pdfBuffer) pdfBuffer = content;
      return;
    }

    // 3. Correo anidado (.eml o message/rfc822 reenviado desde Gmail/Outlook)
    if (nombre.endsWith('.eml') || ctype === 'message/rfc822') {
      try {
        const subParsed = await simpleParser(content);
        for (const subAdj of (subParsed.attachments || [])) {
          await procesarAdjunto(subAdj);
        }
      } catch (err) {
        console.warn('⚠️ Error al parsear .eml anidado:', err.message);
      }
      return;
    }

    // 4. Archivos comprimidos (.zip) — muy común en emisores de Costa Rica
    if (nombre.endsWith('.zip') || ctype.includes('zip') || ctype.includes('compressed')) {
      try {
        const zip = await JSZip.loadAsync(content);
        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const lowerName = relativePath.toLowerCase();
          if (lowerName.endsWith('.xml')) {
            const xmlText = await zipEntry.async('text');
            xmls.push(xmlText);
          } else if (lowerName.endsWith('.pdf') && !pdfBuffer) {
            pdfBuffer = await zipEntry.async('nodebuffer');
          }
        }
      } catch (err) {
        console.warn('⚠️ Error al descomprimir adjunto .zip:', err.message);
      }
      return;
    }

    // 5. Detección por contenido (archivos sin extensión .xml cuyo contenido es XML de Hacienda)
    if (Buffer.isBuffer(content) && content.length > 50) {
      const inicio = content.slice(0, 1000).toString('utf-8');
      if (inicio.includes('<?xml') || inicio.includes('<FacturaElectronica') || inicio.includes('<NotaCreditoElectronica') || inicio.includes('<TiqueteElectronico')) {
        xmls.push(content.toString('utf-8'));
      }
    }
  }

  // Recorrer todos los adjuntos
  for (const adj of (parsed.attachments || [])) {
    await procesarAdjunto(adj);
  }

  // Si no se encontró XML en adjuntos, revisar cuerpo HTML o texto
  if (xmls.length === 0 && (parsed.html || parsed.text)) {
    const cuerpo = (parsed.html || '') + '\n' + (parsed.text || '');
    const xmlRegex = /<\?xml[\s\S]*?<\/(?:FacturaElectronica|NotaCreditoElectronica|TiqueteElectronico)>/gi;
    const matches = cuerpo.match(xmlRegex);
    if (matches) xmls.push(...matches);
  }

  return { xmls, pdfBuffer };
}

/**
 * POST /api/webhooks/email
 * Recibe correos entrantes reenviados por Cloudflare Email Routing / Worker
 */
router.post(
  '/',
  verificarSecreto,
  express.raw({ type: () => true, limit: '50mb' }),
  async (req, res) => {
    try {
      let rawTo = req.headers['x-email-to'] || '';
      let rawFrom = req.headers['x-email-from'] || '';
      let xmlsParaProcesar = [];
      let pdfBuffer = null;

      // Caso 1: Payload JSON (enviado desde un worker que parseó o adjuntó en base64)
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
        }

        if (req.body.rawEmail && xmlsParaProcesar.length === 0) {
          const parsed = await simpleParser(req.body.rawEmail);
          const extraido = await extraerContenidoFactura(parsed);
          xmlsParaProcesar = extraido.xmls;
          pdfBuffer = extraido.pdfBuffer || pdfBuffer;
        }
      }
      // Caso 2: Stream RFC822 crudo enviado directamente por el worker
      else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        console.log(`📬 [Webhook Email] Recibidos ${req.body.length} bytes crudos.`);
        const parsed = await simpleParser(req.body);
        rawTo = rawTo || parsed.to?.text || '';
        rawFrom = rawFrom || parsed.from?.text || '';

        console.log(`📧 [Webhook Email] Asunto: "${parsed.subject}", De: "${rawFrom}", Para: "${rawTo}"`);
        console.log(`📎 [Webhook Email] Adjuntos totales: ${(parsed.attachments || []).length}`);

        const extraido = await extraerContenidoFactura(parsed);
        xmlsParaProcesar = extraido.xmls;
        pdfBuffer = extraido.pdfBuffer;
      }

      const toLimpio = extraerEmailLimpio(rawTo);
      const fromLimpio = extraerEmailLimpio(rawFrom);

      console.log(`📄 [Webhook Email] XMLs válidos encontrados: ${xmlsParaProcesar.length}`);

      if (xmlsParaProcesar.length === 0) {
        console.warn(`⚠️ [Webhook Email] No se encontraron archivos XML de factura en el correo enviado a: ${toLimpio}`);
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
            emailDestino: toLimpio,
            pdfBuffer,
            canal: 'cloudflare-email',
          });
          resultados.push(resultado);
        } catch (err) {
          console.error('❌ Error procesando XML desde email:', err.message);
          resultados.push({ exito: false, error: err.message });
        }
      }

      const exitoCount = resultados.filter(r => r.exito).length;
      console.log(`✅ [Webhook Email] Procesamiento finalizado: ${exitoCount}/${resultados.length} guardadas.`);

      const mensajeResumen = exitoCount > 0
        ? `✅ ${exitoCount} factura(s) guardada(s) con éxito`
        : `⚠️ 0 facturas guardadas: ${resultados[0]?.mensaje || resultados[0]?.error || 'No se pudo procesar el XML'}`;

      return res.status(200).json({
        resumen: mensajeResumen,
        procesadas: exitoCount,
        recibido: true,
        remitente: fromLimpio,
        destinatario: toLimpio,
        detalles: resultados,
      });
    } catch (error) {
      console.error('❌ Error general en Webhook Email:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
