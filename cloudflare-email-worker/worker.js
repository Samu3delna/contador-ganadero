const BACKEND_WEBHOOK_DEFAULT = 'https://contador-ganadero.onrender.com/api/webhooks/email';
const MAX_EMAIL_BYTES = 10 * 1024 * 1024;
const MAX_ATTEMPTS = 3;

function log(event, fields = {}, level = 'log') {
  const payload = JSON.stringify({ service: 'contador-ganadero-email', event, ...fields });
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(payload);
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWebhookUrl(env) {
  const url = new URL(env.BACKEND_WEBHOOK_URL || BACKEND_WEBHOOK_DEFAULT);
  if (url.protocol !== 'https:') {
    throw new Error('BACKEND_WEBHOOK_URL debe usar HTTPS');
  }
  return url.toString();
}

async function enviarAlBackend(message, env, rawEmail, webhookUrl) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'message/rfc822',
          'X-Email-To': message.to,
          'X-Email-From': message.from,
          'X-Email-Webhook-Secret': env.EMAIL_WEBHOOK_SECRET,
        },
        body: rawEmail,
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = null;
      }

      if (response.ok) {
        const procesadas = Number(result?.procesadas || 0);
        const totalAdjuntos = Array.isArray(result?.detalles) ? result.detalles.length : 0;
        const event = totalAdjuntos > procesadas ? 'email_partially_processed' : 'email_processed';
        log(event, {
          attempt,
          backendStatus: response.status,
          processed: procesadas,
          receivedXmlCount: totalAdjuntos,
        }, totalAdjuntos > procesadas ? 'warn' : 'log');
        return;
      }

      log('backend_rejected_email', { attempt, backendStatus: response.status }, 'error');
      const retryable = response.status === 429 || response.status >= 500;
      const error = new Error(`Backend rechazó la ingesta (HTTP ${response.status})`);
      error.retryable = retryable;
      throw error;
    } catch (error) {
      if (error?.retryable === false || attempt === MAX_ATTEMPTS) throw error;
      log('backend_attempt_failed', { attempt, error: error?.name || 'Error' }, 'warn');
    }

    await esperar(250 * (2 ** (attempt - 1)));
  }
}

export default {
  async email(message, env) {
    try {
      if (!env.EMAIL_WEBHOOK_SECRET) {
        throw new Error('EMAIL_WEBHOOK_SECRET no está configurado');
      }

      const webhookUrl = getWebhookUrl(env);
      if (message.rawSize > MAX_EMAIL_BYTES) {
        log('email_rejected_too_large', { sizeBytes: message.rawSize }, 'error');
        message.setReject('Email exceeds the invoice processing size limit');
        return;
      }

      const rawEmail = await new Response(message.raw).arrayBuffer();
      log('email_received', { sizeBytes: rawEmail.byteLength });
      await enviarAlBackend(message, env, rawEmail, webhookUrl);
    } catch (error) {
      log('email_processing_failed', { error: error?.name || 'Error' }, 'error');
      throw error;
    }
  },
};
