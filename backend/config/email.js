/**
 * Configuración del cliente IMAP
 */

const configurarIMAP = () => {
  return {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT) || 993,
    secure: process.env.IMAP_TLS === 'true',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD,
    },
    logger: false,
  };
};

module.exports = { configurarIMAP };
