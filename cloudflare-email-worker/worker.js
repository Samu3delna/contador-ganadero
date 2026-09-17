/**
 * Cloudflare Email Worker — ContadorGanadero
 * 
 * Captura todos los correos entrantes en *@contadorganandero.com y los envía
 * en tiempo real a tu API en Render sin usar IMAP.
 */

export default {
  async email(message, env, ctx) {
    try {
      // 1. Leer el contenido MIME del correo completo como buffer
      const rawEmail = await new Response(message.raw).arrayBuffer();

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error del backend (${response.status}): ${errorText}`);
      } else {
        console.log(`Email procesado exitosamente para: ${message.to}`);
      }
    } catch (err) {
      console.error('Error al procesar correo en Cloudflare Worker:', err.message);
    }
  },
};
