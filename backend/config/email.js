/**
 * Configuración del cliente IMAP
 */

const configurarIMAP = () => {
  const port = Number(process.env.IMAP_PORT) || 993;
  const user = (process.env.IMAP_USER || '').trim();
  // Gmail muestra la contraseña de app con espacios para legibilidad, pero el valor real NO tiene espacios.
  // También limpiamos caracteres de control y aseguramos que sea string.
  let pass = process.env.IMAP_PASSWORD || '';
  if (typeof pass === 'string') {
    pass = pass.replace(/\s+/g, '').trim();
  }

  return {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port,
    // Por defecto true para evitar fallos de conexión en servidores como Gmail (993)
    secure: process.env.IMAP_TLS !== 'false',
    auth: {
      user,
      pass,
    },
    logger: false,
    tls: {
      // Evita errores por certificados autofirmados en algunos servidores IMAP
      rejectUnauthorized: false,
    },
  };
};

module.exports = { configurarIMAP };
