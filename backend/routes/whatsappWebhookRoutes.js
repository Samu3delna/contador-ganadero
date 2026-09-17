const express = require('express');
const router = express.Router();
const { enviarMensajeWhatsApp, descargarMediaMeta } = require('../services/whatsappService');
const { procesarFacturaXMLString, resolverDestinatario } = require('../services/ingestaFacturaService');

/**
 * GET /api/webhooks/whatsapp
 * Verificación del webhook por parte de Meta Cloud API (Handshake)
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'contador_ganadero_wa_secret';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook de WhatsApp verificado por Meta exitosamente.');
      return res.status(200).send(challenge);
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
router.post('/', async (req, res) => {
  // Responder 200 de inmediato a Meta para evitar reintentos duplicados
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
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
      await enviarMensajeWhatsApp(
        fromPhone,
        `👋 ¡Hola ${usuario.nombre}!\n\nSoy el bot de *ContadorGanadero* para tu finca (*${usuario.nombreFinca || 'Mi Finca'}*).\n\n📌 *¿Cómo usarme?*\n• Reenvíame cualquier archivo *.XML* o *.PDF* de factura que te envíe un proveedor para registrar el gasto al instante.\n• Envíame fotos de recibos o compras físicas.\n\nTambién puedes ver tus números en https://contadorganandero.com`
      );
    }
  } catch (error) {
    console.error('❌ Error procesando webhook de WhatsApp:', error);
  }
});

module.exports = router;
