/**
 * Configuración del cliente IMAP
 */

const configurarIMAP = () => {
  const port = Number(process.env.IMAP_PORT) || 993;
  const user = (process.env.IMAP_USER || '').trim();
  let pass = process.env.IMAP_PASSWORD || '';
  if (typeof pass === 'string') {
    pass = pass.trim();
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
      // Verifica certificados TLS por defecto; solo desactiva si IMAP_ALLOW_SELF_SIGNED=true explícitamente
      rejectUnauthorized: process.env.IMAP_ALLOW_SELF_SIGNED === 'true' ? false : true,
    },
  };
};

module.exports = { configurarIMAP };
