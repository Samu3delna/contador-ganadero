const crypto = require('crypto');

/**
 * @desc    Enviar formulario de contacto/soporte a los super admins
 * @route   POST /api/support/contact
 * @access  Público (con rate limiting)
 */
const enviarContactoSoporte = async (req, res, next) => {
  try {
    const { nombre, email, asunto, mensaje, tenantId } = req.body;

    // Validación básica
    if (!nombre || !email || !asunto || !mensaje) {
      return res.status(400).json({
        error: 'CAMPOS_REQUERIDOS',
        mensaje: 'Todos los campos son obligatorios: nombre, email, asunto, mensaje',
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'EMAIL_INVALIDO',
        mensaje: 'El formato del email no es válido',
      });
    }

    // Validar longitud
    if (nombre.length > 100 || asunto.length > 200 || mensaje.length > 5000) {
      return res.status(400).json({
        error: 'DATOS_DEMASIADO_LARGOS',
        mensaje: 'Los datos exceden la longitud máxima permitida',
      });
    }

    // Obtener emails de super admins desde variable de entorno
    const superAdminEmailsRaw = process.env.SUPER_ADMIN_EMAILS || '';
    const superAdminEmails = superAdminEmailsRaw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (superAdminEmails.length === 0) {
      console.warn('⚠️ SUPER_ADMIN_EMAILS no configurado, no se puede enviar email de soporte');
      return res.status(503).json({
        error: 'SOPORTE_NO_CONFIGURADO',
        mensaje: 'El servicio de soporte no está disponible temporalmente',
      });
    }

    // Preparar el contenido del email
    const tenantInfo = tenantId
      ? `\n\n--- Información del Tenant ---\nTenant ID: ${tenantId}`
      : '';

    const userAgent = req.get('User-Agent') || 'Desconocido';
    const ip = req.ip || req.connection?.remoteAddress || 'Desconocida';

    const textoPlano = `
Nuevo mensaje de soporte desde ContadorGanadero

--- Datos del remitente ---
Nombre: ${nombre}
Email: ${email}${tenantInfo}

--- Mensaje ---
${mensaje}

--- Metadatos ---
Asunto: ${asunto}
User-Agent: ${userAgent}
IP: ${ip}
Fecha: ${new Date().toISOString()}
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .field { margin-bottom: 16px; }
    .label { font-weight: 600; color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { margin-top: 4px; padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; }
    .message-box { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; white-space: pre-wrap; }
    .meta { font-size: 12px; color: #94a3b8; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .footer { background: #1e40af; color: white; padding: 16px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 20px;">📨 Nuevo mensaje de soporte</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">ContadorGanadero</p>
  </div>
  <div class="content">
    <div class="field">
      <div class="label">Nombre</div>
      <div class="value">${escapeHtml(nombre)}</div>
    </div>
    <div class="field">
      <div class="label">Email</div>
      <div class="value">${escapeHtml(email)}</div>
    </div>
    ${tenantId ? `
    <div class="field">
      <div class="label">Tenant ID</div>
      <div class="value">${escapeHtml(tenantId)}</div>
    </div>
    ` : ''}
    <div class="field">
      <div class="label">Asunto</div>
      <div class="value">${escapeHtml(asunto)}</div>
    </div>
    <div class="field">
      <div class="label">Mensaje</div>
      <div class="message-box">${escapeHtml(mensaje)}</div>
    </div>
    <div class="meta">
      <strong>Metadatos:</strong><br>
      User-Agent: ${escapeHtml(userAgent)}<br>
      IP: ${escapeHtml(ip)}<br>
      Fecha: ${new Date().toISOString()}
    </div>
  </div>
  <div class="footer">
    Este email fue generado automáticamente desde el formulario de soporte de ContadorGanadero
  </div>
</body>
</html>
    `.trim();

    // Enviar email via Cloudflare Email Sending REST API
    const resultado = await enviarEmailCloudflare({
      to: superAdminEmails,
      subject: `[Soporte] ${asunto}`,
      text: textoPlano,
      html: html,
      replyTo: email,
    });

    if (!resultado.success) {
      console.error('❌ Error enviando email de soporte:', resultado.error);
      return res.status(500).json({
        error: 'ERROR_ENVIO_EMAIL',
        mensaje: 'No se pudo enviar el mensaje de soporte. Inténtalo más tarde.',
      });
    }

    console.log('✅ Email de soporte enviado a super admins:', superAdminEmails.join(', '));

    res.json({
      ok: true,
      mensaje: 'Tu mensaje ha sido enviado correctamente. Nuestro equipo de soporte te responderá pronto.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Envía email usando Cloudflare Email Sending REST API
 * @param {Object} params
 * @param {string[]} params.to - Array de emails destinatarios
 * @param {string} params.subject - Asunto
 * @param {string} params.text - Texto plano
 * @param {string} params.html - HTML
 * @param {string} [params.replyTo] - Email para responder
 * @returns {Promise<{success: boolean, error?: string, id?: string}>}
 */
async function enviarEmailCloudflare({ to, subject, text, html, replyTo }) {
  const apiToken = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const fromEmail = process.env.CLOUDFLARE_EMAIL_FROM || 'soporte@contadorganandero.com';
  const fromName = process.env.CLOUDFLARE_EMAIL_FROM_NAME || 'ContadorGanadero Soporte';

  if (!apiToken || !accountId) {
    return {
      success: false,
      error: 'Credenciales de Cloudflare Email no configuradas (CLOUDFLARE_EMAIL_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)',
    };
  }

  // Validar que el dominio del from esté verificado en Cloudflare Email Sending
  const fromDomain = fromEmail.split('@')[1];
  if (!fromDomain) {
    return {
      success: false,
      error: 'Email remitente inválido',
    };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/messages`;

  const payload = {
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: to.map((email) => ({ email })),
    subject,
    text,
    html,
    ...(replyTo && { reply_to: replyTo }),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.errors?.[0]?.message || data.message || 'Error desconocido';
      console.error('❌ Cloudflare Email API error:', data);
      return { success: false, error: `Cloudflare API: ${errorMsg}` };
    }

    if (!data.success) {
      const errorMsg = data.errors?.[0]?.message || 'Error en respuesta de Cloudflare';
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      id: data.result?.id,
    };
  } catch (error) {
    console.error('❌ Error de red enviando email:', error);
    return { success: false, error: `Error de red: ${error.message}` };
  }
}

module.exports = {
  enviarContactoSoporte,
  enviarEmailCloudflare,
};