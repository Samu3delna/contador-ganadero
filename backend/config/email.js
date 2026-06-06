/**
 * Configuración del cliente IMAP
 */

const configurarIMAP = () => {
  const port = Number(process.env.IMAP_PORT) || 993;
  return {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port,
    // Por defecto true para evitar fallos de conexión en servidores como Gmail (993)
    secure: process.env.IMAP_TLS !== 'false',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD,
    },
    logger: false,
    tls: {
      // Evita errores por certificados autofirmados en algunos servidores IMAP
      rejectUnauthorized: false,
    },
  };
};

module.exports = { configurarIMAP };
