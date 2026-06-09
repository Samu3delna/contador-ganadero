/**
 * Script de diagnóstico IMAP
 * Prueba paso a paso la conexión y autenticación con Gmail
 */
require('dotenv').config({ path: '../.env' });
const { ImapFlow } = require('imapflow');
const dns = require('dns');
const net = require('net');

// Usar DNS del sistema con fallback a públicos
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('No se pudo configurar DNS fallback:', err.message);
}

const DIVIDER = '═'.repeat(60);

async function diagnostico() {
  console.log(DIVIDER);
  console.log('🔬 DIAGNÓSTICO IMAP — Contador Ganadero');
  console.log(DIVIDER);

  // 1. Verificar variables de entorno
  console.log('\n📋 PASO 1: Variables de entorno');
  const host = process.env.IMAP_HOST || 'imap.gmail.com';
  const port = Number(process.env.IMAP_PORT) || 993;
  const user = (process.env.IMAP_USER || '').trim();
  const rawPass = process.env.IMAP_PASSWORD || '';
  // Replicate lo que hace config/email.js
  const pass = rawPass.replace(/\s+/g, '').trim();

  console.log(`   IMAP_HOST     = ${host}`);
  console.log(`   IMAP_PORT     = ${port}`);
  console.log(`   IMAP_USER     = ${user || '❌ NO CONFIGURADO'}`);
  console.log(`   IMAP_PASSWORD = ${rawPass ? `"${rawPass}" (${rawPass.length} chars con espacios)` : '❌ NO CONFIGURADO'}`);
  console.log(`   Password procesado (sin espacios) = "${pass}" (${pass.length} chars)`);
  console.log(`   IMAP_TLS      = ${process.env.IMAP_TLS || 'no definido (default: true)'}`);

  if (!user || !pass) {
    console.log('\n🚨 RESULTADO: Credenciales vacías. Configura IMAP_USER y IMAP_PASSWORD en .env');
    process.exit(1);
  }

  // 2. DNS
  console.log(`\n📋 PASO 2: Resolución DNS de ${host}`);
  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve4(host, (err, addrs) => err ? reject(err) : resolve(addrs));
    });
    console.log(`   ✅ DNS resuelto: ${addresses.join(', ')}`);
  } catch (err) {
    console.log(`   ❌ Error DNS: ${err.message}`);
    console.log('   → Verifica tu conexión a internet o que el host sea correcto');
    process.exit(1);
  }

  // 3. Conectividad TCP
  console.log(`\n📋 PASO 3: Conectividad TCP a ${host}:${port}`);
  try {
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port, timeout: 10000 }, () => {
        console.log(`   ✅ Conexión TCP exitosa a ${host}:${port}`);
        socket.destroy();
        resolve();
      });
      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Timeout de conexión'));
      });
    });
  } catch (err) {
    console.log(`   ❌ Error TCP: ${err.message}`);
    console.log('   → El puerto puede estar bloqueado por firewall');
    process.exit(1);
  }

  // 4. Autenticación IMAP
  console.log(`\n📋 PASO 4: Autenticación IMAP con ImapFlow`);
  console.log(`   Conectando como: ${user}`);

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: {
      debug: () => {},
      info: (msg) => console.log(`   [IMAP-INFO] ${JSON.stringify(msg)}`),
      warn: (msg) => console.log(`   [IMAP-WARN] ${JSON.stringify(msg)}`),
      error: (msg) => console.log(`   [IMAP-ERR]  ${JSON.stringify(msg)}`),
    },
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`   ✅ AUTENTICACIÓN EXITOSA`);
  } catch (err) {
    console.log(`   ❌ AUTENTICACIÓN FALLIDA`);
    console.log(`   Error: ${err.message}`);
    if (err.response) console.log(`   Response: ${err.response}`);
    if (err.code) console.log(`   Code: ${err.code}`);

    console.log('\n' + DIVIDER);
    console.log('🚨 DIAGNÓSTICO: La contraseña de aplicación es INVÁLIDA.');
    console.log(DIVIDER);
    console.log('');
    console.log('Esto ocurre porque:');
    console.log('  1. La App Password de Gmail fue revocada o expiró');
    console.log('  2. Cambiaste tu contraseña de Gmail (esto revoca TODAS las App Passwords)');
    console.log('  3. Desactivaste y reactivaste la verificación en 2 pasos');
    console.log('  4. Google la revocó por inactividad o seguridad');
    console.log('');
    console.log('SOLUCIÓN:');
    console.log('  1. Abre: https://myaccount.google.com/apppasswords');
    console.log('     (con la cuenta contadoriasam@gmail.com)');
    console.log('  2. Verifica que tengas la verificación en 2 pasos ACTIVA');
    console.log('  3. Genera una NUEVA contraseña de aplicación');
    console.log('  4. Actualiza IMAP_PASSWORD en:');
    console.log('     a) Tu archivo .env local');
    console.log('     b) Las variables de entorno en Render');
    console.log('  5. Reinicia el servidor / redeploy en Render');
    console.log('');

    // Intentar con la password CON espacios (por si el strip de espacios es el problema)
    console.log('📋 PASO 4b: Intentando con la contraseña CON espacios (sin strip)...');
    const client2 = new ImapFlow({
      host,
      port,
      secure: true,
      auth: { user, pass: rawPass.trim() },
      logger: false,
      tls: { rejectUnauthorized: false },
    });
    try {
      await client2.connect();
      console.log('   ✅ ¡FUNCIONA CON ESPACIOS!');
      console.log('   → El problema es que config/email.js elimina los espacios de la contraseña.');
      console.log('   → Gmail App Passwords tienen formato "xxxx xxxx xxxx xxxx" y SÍ aceptan espacios.');

      // Listar carpetas para mostrar que funciona
      console.log('\n📋 PASO 5: Listando carpetas disponibles...');
      const mailboxes = await client2.list();
      for (const mb of mailboxes) {
        console.log(`   📂 ${mb.path} (${mb.listed ? 'disponible' : 'oculto'})`);
      }

      // Probar INBOX
      console.log('\n📋 PASO 6: Probando lectura de INBOX...');
      const lock = await client2.getMailboxLock('INBOX');
      try {
        console.log(`   Total de mensajes en INBOX: ${client2.mailbox.exists}`);
        
        // Últimos 5 emails
        if (client2.mailbox.exists > 0) {
          const start = Math.max(1, client2.mailbox.exists - 4);
          const range = `${start}:*`;
          console.log(`   Últimos emails (${range}):`);
          for await (const msg of client2.fetch(range, { envelope: true })) {
            console.log(`     📧 ${msg.envelope.date?.toISOString?.() || 'sin fecha'} | De: ${msg.envelope.from?.[0]?.address || '?'} | Asunto: ${msg.envelope.subject || '(sin asunto)'}`);
          }
        }
      } finally {
        lock.release();
      }

      await client2.logout();
       
      console.log('\n' + DIVIDER);
      console.log('✅ DIAGNÓSTICO COMPLETO: La contraseña FUNCIONA con espacios.');
      console.log('   El bug está en config/email.js que hace .replace(/\\s+/g, "")');
      console.log('   Gmail App Passwords aceptan formato con o sin espacios,');
      console.log('   pero tu password específico requiere los espacios.');
      console.log(DIVIDER);
    } catch (err2) {
      console.log(`   ❌ También falla con espacios: ${err2.message}`);
      console.log('\n' + DIVIDER);
      console.log('🚨 CONCLUSIÓN: La contraseña de aplicación es COMPLETAMENTE INVÁLIDA.');
      console.log('   Necesitas generar una nueva en https://myaccount.google.com/apppasswords');
      console.log(DIVIDER);
      try { await client2.logout(); } catch (err3) { console.warn('Error cerrando client2:', err3.message); }
    }

    process.exit(1);
  }

  // Si llega aquí: autenticación exitosa con la password sin espacios
  console.log('\n📋 PASO 5: Listando carpetas disponibles...');
  try {
    const mailboxes = await client.list();
    for (const mb of mailboxes) {
      console.log(`   📂 ${mb.path}`);
    }
  } catch (err) {
    console.log(`   ⚠️ Error listando: ${err.message}`);
  }

  console.log('\n📋 PASO 6: Probando lectura de INBOX...');
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      console.log(`   Total de mensajes en INBOX: ${client.mailbox.exists}`);
      
      if (client.mailbox.exists > 0) {
        const start = Math.max(1, client.mailbox.exists - 4);
        const range = `${start}:*`;
        console.log(`   Últimos emails (rango ${range}):`);
        for await (const msg of client.fetch(range, { envelope: true })) {
          const hasAttachments = msg.bodyStructure?.childNodes?.length > 1 ? '📎' : '';
          console.log(`     📧 ${msg.envelope.date?.toISOString?.() || '?'} | De: ${msg.envelope.from?.[0]?.address || '?'} | ${msg.envelope.subject || '(sin asunto)'} ${hasAttachments}`);
        }
      } else {
        console.log('   ⚠️ INBOX está vacío');
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.log(`   ❌ Error leyendo INBOX: ${err.message}`);
  }

  // Probar spam
  console.log('\n📋 PASO 7: Probando carpeta de Spam...');
  try {
    const lockSpam = await client.getMailboxLock('[Gmail]/Spam');
    try {
      console.log(`   Total de mensajes en Spam: ${client.mailbox.exists}`);
    } finally {
      lockSpam.release();
    }
  } catch (err) {
    console.log(`   ⚠️ No se pudo abrir [Gmail]/Spam: ${err.message}`);
  }

  await client.logout();

  console.log('\n' + DIVIDER);
  console.log('✅ DIAGNÓSTICO COMPLETO: Todo funciona correctamente.');
  console.log(DIVIDER);
  process.exit(0);
}

diagnostico().catch(err => {
  console.error('Error fatal en diagnóstico:', err);
  process.exit(1);
});
