const axios = require('axios');

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Envía un mensaje de texto por WhatsApp usando Meta Cloud API
 */
async function enviarMensajeWhatsApp(telefonoDestino, texto) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[WHATSAPP MOCK] Enviar a ${telefonoDestino}: ${texto}`);
    return { mock: true, enviado: true };
  }

  // Normalizar número (solo dígitos)
  const to = String(telefonoDestino).replace(/\D/g, '');

  try {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: texto },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando mensaje WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Descarga un archivo multimedia (XML, PDF o Imagen) desde los servidores de Meta
 */
async function descargarMediaMeta(mediaId) {
  if (!WHATSAPP_TOKEN) {
    throw new Error('WHATSAPP_ACCESS_TOKEN no configurado');
  }

  // 1. Obtener la URL de descarga del recurso
  const metaMediaUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${mediaId}`;
  const metaRes = await axios.get(metaMediaUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
  });

  const downloadUrl = metaRes.data?.url;
  if (!downloadUrl) {
    throw new Error(`No se pudo obtener URL de descarga para mediaId ${mediaId}`);
  }

  // 2. Descargar el archivo binario
  const downloadRes = await axios.get(downloadUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    responseType: 'arraybuffer',
  });

  return {
    buffer: Buffer.from(downloadRes.data),
    mimeType: metaRes.data?.mime_type || downloadRes.headers['content-type'],
  };
}

module.exports = {
  enviarMensajeWhatsApp,
  descargarMediaMeta,
};
