require('dotenv').config({ path: '../.env' });
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

async function checkMailbox() {
  const clienteIMAP = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_TLS === 'true',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD,
    },
    logger: false
  });

  try {
    await clienteIMAP.connect();
    console.log('Conectado a IMAP');

    const unaSemanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const carpetas = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Spam'];
    
    for (const carpeta of carpetas) {
      console.log(`\nRevisando carpeta: ${carpeta}`);
      let lock;
      try {
        lock = await clienteIMAP.getMailboxLock(carpeta);
      } catch {
        console.log(`Carpeta no existe: ${carpeta}`);
        continue;
      }
      
      const mensajes = clienteIMAP.fetch({ since: unaSemanaAtras }, { source: true, envelope: true });
      let cuenta = 0;
      for await (const msg of mensajes) {
        cuenta++;
        const parsed = await simpleParser(msg.source);
        console.log(`- Email: "${parsed.subject}" de ${parsed.from?.text}`);
        
        if (parsed.attachments && parsed.attachments.length > 0) {
          console.log(`  Adjuntos (${parsed.attachments.length}):`);
          for (const adj of parsed.attachments) {
            console.log(`    * ${adj.filename} (${adj.contentType}) - ${adj.size} bytes`);
          }
        } else {
          console.log(`  Sin adjuntos.`);
        }
      }
      console.log(`Total emails en ${carpeta} en últimos 7 días: ${cuenta}`);
      lock.release();
    }
  } catch (error) {
    console.error(error);
  } finally {
    await clienteIMAP.logout();
    console.log('Desconectado.');
    process.exit(0);
  }
}

checkMailbox();
