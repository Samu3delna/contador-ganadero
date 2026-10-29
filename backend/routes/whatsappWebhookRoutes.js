const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { enviarMensajeWhatsApp, descargarMediaMeta } = require('../services/whatsappService');
const { procesarFacturaXMLString, resolverDestinatario } = require('../services/ingestaFacturaService');
const {
  ejecutarEliminacionDatos,
  handleMetaDataDeletionCallback,
  infoMetaDataDeletionWebhook,
  obtenerEstadoEliminacion,
  crearSolicitudEliminacionPublica,
} = require('../controllers/dataDeletionController');

/**
 * Verifica firma HMAC-SHA256 de Meta (X-Hub-Signature-256) cuando META_APP_SECRET está configurado
 */
function verificarFirmaMeta(req, res, next) {
  const appSecret = process.env.META_APP_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const signatureHeader = req.headers['x-hub-signature-256'];

  if (!appSecret) {
    if (isProd) {
      return res.status(503).json({ error: 'Webhook de WhatsApp no configurado (falta META_APP_SECRET)' });
    }
    return next();
  }

  if (!signatureHeader) {
    if (isProd) {
      return res.status(401).json({ error: 'Falta firma X-Hub-Signature-256' });
    }
    return next();
  }

  const rawPayload = req.rawBody || JSON.stringify(req.body || {});
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawPayload).digest('hex');
  const bufA = Buffer.from(String(signatureHeader));
  const bufB = Buffer.from(expectedSig);

  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return res.status(401).json({ error: 'Firma X-Hub-Signature-256 inválida' });
  }
  return next();
}

/**
 * GET /api/webhooks/whatsapp
 * Verificación del webhook por parte de Meta Cloud API (Handshake)
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!VERIFY_TOKEN) {
    return res.sendStatus(503);
  }

  if (mode && token) {
    const bufA = Buffer.from(String(token));
    const bufB = Buffer.from(String(VERIFY_TOKEN));
    if (mode === 'subscribe' && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      console.log('✅ Webhook de WhatsApp verificado por Meta exitosamente.');
      return res.status(200).send(String(challenge || ''));
    } else {
      console.warn('⚠️ Intento de verificación de WhatsApp fallido (token incorrecto).');
      return res.sendStatus(403);
    }
  }

  return res.sendStatus(400);
});

/**
 * POST /api/webhooks/whatsapp
 * Recepción y procesamiento de mensajes de WhatsApp
 */
router.post('/', verificarFirmaMeta, async (req, res) => {
  // Responder 200 de inmediato a Meta para evitar reintentos duplicados
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (!body || body.object !== 'whatsapp_business_account') {
      return;
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return; // Notificaciones de status (sent, delivered, read), no mensajes nuevos
    }

    const message = messages[0];
    const fromPhone = message.from; // Número del remitente (ej: "50688888888")
    const msgType = message.type;

    console.log(`📱 WhatsApp recibido de +${fromPhone} (tipo: ${msgType})`);

    // 1. Identificar al usuario por número de teléfono
    const { usuario, tenantId } = await resolverDestinatario({ telefono: fromPhone });

    if (!usuario) {
      await enviarMensajeWhatsApp(
        fromPhone,
        `👋 ¡Hola! No encontramos ninguna finca asociada a tu número (+${fromPhone}) en ContadorGanadero.\n\nPor favor inicia sesión en https://contadorganandero.com y registra tu número en tu perfil para empezar a enviar facturas.`
      );
      return;
    }

    // 2. Procesar según el tipo de contenido
    if (msgType === 'document') {
      const doc = message.document;
      const fileName = (doc.filename || '').toLowerCase();
      const mime = (doc.mime_type || '').toLowerCase();

      // Es un archivo XML de Hacienda
      if (fileName.endsWith('.xml') || mime.includes('xml')) {
        try {
          const { buffer } = await descargarMediaMeta(doc.id);
          const resultado = await procesarFacturaXMLString(buffer, {
            telefono: fromPhone,
            usuarioId: usuario._id,
            tenantId,
            canal: 'whatsapp',
          });

          if (resultado.duplicada) {
            await enviarMensajeWhatsApp(
              fromPhone,
              `ℹ️ La factura con Clave ${resultado.factura.claveNumerica?.slice(-8) || ''} ya estaba registrada previamente en tu finca.`
            );
          } else if (resultado.exito) {
            const montoFormateado = (resultado.total || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 });
            const mensajeRespuesta = [
              `✅ *¡Factura registrada con éxito!*`,
              `🏪 *Emisor:* ${resultado.emisor}`,
              `💰 *Total:* ₡${montoFormateado}`,
              `🏷️ *Categoría REA:* ${resultado.factura?.categoriaIA || 'Insumos'}`,
              resultado.alertas > 0 ? `⚠️ *Alerta:* Se detectó posible tarifa de IVA no agropecuaria para revisión.` : null,
              `\nConsulta el reporte completo en https://contadorganandero.com/facturas`,
            ].filter(Boolean).join('\n');

            await enviarMensajeWhatsApp(fromPhone, mensajeRespuesta);
          } else {
            await enviarMensajeWhatsApp(
              fromPhone,
              `⚠️ ${resultado.mensaje || 'No se pudo procesar el archivo XML.'}`
            );
          }
        } catch (err) {
          console.error('❌ Error procesando documento XML de WhatsApp:', err);
          await enviarMensajeWhatsApp(
            fromPhone,
            `❌ Hubo un error al procesar tu factura XML: ${err.message}`
          );
        }
      }
      // Es un PDF
      else if (fileName.endsWith('.pdf') || mime.includes('pdf')) {
        await enviarMensajeWhatsApp(
          fromPhone,
          `📄 Recibimos tu factura en PDF (*${doc.filename || 'factura'}*).\n\n💡 *Consejo:* Para que el sistema desglose automáticamente el IVA, el emisor y calcule tus impuestos de Hacienda, pídele a tu proveedor que te envíe también el archivo *.XML* y reenvíalo aquí.`
        );
      }
    }
    // Es una imagen / foto de recibo o tiquete
    else if (msgType === 'image') {
      await enviarMensajeWhatsApp(
        fromPhone,
        `📸 *Foto de comprobante recibida.*\n\nLa hemos guardado en tu cuenta para que el asistente de IA analice los montos y puedas deducirla en tus gastos.`
      );
    }
    // Es un mensaje de texto
    else if (msgType === 'text') {
      const texto = (message.text?.body || '').trim();
      const textoLower = texto.toLowerCase();

      if (
        textoLower === 'eliminar mis datos' ||
        textoLower === 'eliminar datos' ||
        textoLower === 'borrar mis datos'
      ) {
        const eliminacion = await ejecutarEliminacionDatos({
          telefono: fromPhone,
          usuarioId: usuario._id,
          origen: 'whatsapp_bot',
        });
        await enviarMensajeWhatsApp(
          fromPhone,
          `🗑️ *Solicitud de eliminación de datos completada.*\n\n🔑 *Código de confirmación:* ${eliminacion.confirmation_code}\n🔗 *Estado de la solicitud:* ${eliminacion.url}`
        );
        return;
      }

      await enviarMensajeWhatsApp(
        fromPhone,
        `👋 ¡Hola ${usuario.nombre}!\n\nSoy el bot de *ContadorGanadero* para tu finca (*${usuario.nombreFinca || 'Mi Finca'}*).\n\n📌 *¿Cómo usarme?*\n• Reenvíame cualquier archivo *.XML* o *.PDF* de factura que te envíe un proveedor para registrar el gasto al instante.\n• Envíame fotos de recibos o compras físicas.\n• Si deseas eliminar tus datos, escribe *ELIMINAR MIS DATOS* o visita https://contadorganandero.com/eliminacion-datos\n\nTambién puedes ver tus números en https://contadorganandero.com`
      );
    }
  } catch (error) {
    console.error('❌ Error procesando webhook de WhatsApp:', error);
  }
});

/**
 * Devolución de llamada de solicitud de eliminación de datos de Meta (Facebook / WhatsApp)
 * URL para Meta App Dashboard:
 *   POST /api/webhooks/whatsapp/data-deletion
 *   GET  /api/webhooks/whatsapp/data-deletion/status/:code
 *   POST /api/webhooks/whatsapp/data-deletion/solicitud
 */
router.get('/data-deletion', infoMetaDataDeletionWebhook);
router.post('/data-deletion', handleMetaDataDeletionCallback);
router.get('/data-deletion/status/:code', obtenerEstadoEliminacion);
router.post('/data-deletion/solicitud', crearSolicitudEliminacionPublica);

module.exports = router;
