/**
 * Cloudflare Email Worker — ContadorGanadero
 * 
 * Captura todos los correos entrantes en *@contadorganandero.com y los envía
 * en tiempo real a tu API en Render sin usar IMAP.
 */

export default {
  async email(message, env, ctx) {
    try {
      console.log(`📥 [CF Worker] Recibiendo correo para: ${message.to} de: ${message.from}`);

      // 1. Leer el contenido MIME del correo completo como buffer
      const rawEmail = await new Response(message.raw).arrayBuffer();
      console.log(`📦 [CF Worker] Tamaño MIME: ${rawEmail.byteLength} bytes`);

      // 2. URL de tu backend en Render
      const webhookUrl = env.BACKEND_WEBHOOK_URL || 'https://contador-ganadero.onrender.com/api/webhooks/email';

      // 3. Enviar el correo por HTTP POST directo a tu backend
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'message/rfc822',
          'X-Email-To': message.to,
          'X-Email-From': message.from,
          'X-Email-Webhook-Secret': env.EMAIL_WEBHOOK_SECRET || '',
        },
        body: rawEmail,
      });

      const responseText = await response.text();
      if (!response.ok) {
        console.error(`❌ [CF Worker] Error del backend (${response.status}): ${responseText}`);
      } else {
        console.log(`✅ [CF Worker] Éxito (${response.status}): ${responseText}`);
      }
    } catch (err) {
      console.error('❌ [CF Worker] Error al procesar correo:', err.message);
    }
  },
};
