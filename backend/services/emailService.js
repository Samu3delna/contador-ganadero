/**
 * Servicio de Email IMAP — Escucha y descarga de facturas electrónicas
 * Usa ImapFlow (moderno, async/await, soporte IDLE nativo)
 *
 * Funcionalidades:
 *  - Busca adjuntos .xml en INBOX y en la carpeta de Spam/Junk
 *  - Descarga y guarda los archivos XML y PDF en disco
 *  - Parsea facturas con validación de CodigoTarifa
 *  - Categoriza automáticamente con IA
 *  - Genera alertas si el CodigoTarifa no corresponde al beneficio agropecuario
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const { configurarIMAP } = require('../config/email');
const inbox = require('./ingestionInbox');
const { extraerContenidoFactura } = require('./emailAttachments');

// Estado del servicio
let conexionActiva = false;
let ultimaSincronizacion = null;
let clienteIMAP = null;
let estadisticas = {
  emailsProcesados: 0,
  xmlsDescargados: 0,
  facturasCreadas: 0,
  alertasTarifa: 0,
  errores: 0,
};

let lockIdle = null;
let pausandoIdle = false;
let syncInterval = null;
let reconnectTimeout = null;
let reconectando = false;
let intentosReconexion = 0;
const MAX_INTENTOS_RECONEXION = 10;

function logErrorDetallado(contexto, error) {
  console.error(`❌ [${contexto}] Error: ${error.message || error}`);
  if (error.code) console.error(`   Code: ${error.code}`);
  if (error.response) console.error(`   Response: ${error.response}`);
  if (error.stack && process.env.NODE_ENV !== 'production') {
    console.error(`   Stack: ${error.stack}`);
  }
}

async function liberarLockIdle() {
  if (lockIdle) {
    console.log('🔓 Liberando lock de IDLE temporalmente...');
    try {
      await lockIdle.release();
    } catch (err) {
      console.warn('Error liberando lock IDLE:', err.message);
    }
    lockIdle = null;
  }
}

async function restablecerLockIdle() {
  if (conexionActiva && clienteIMAP && !lockIdle && !pausandoIdle) {
    console.log('🔒 Restableciendo lock de IDLE...');
    try {
      lockIdle = await clienteIMAP.getMailboxLock('INBOX');
      console.log('🔒 Lock de INBOX restablecido correctamente');
    } catch (e) {
      console.error('⚠️ No se pudo restablecer el lock de INBOX:', e.message);
      // Si falla, intentar de nuevo en 5 segundos
      setTimeout(() => restablecerLockIdle(), 5000);
    }
  }
}

// Directorio para guardar archivos adjuntos
const UPLOADS_DIR = path.resolve(process.env.UPLOAD_ROOT || path.join(__dirname, '..', 'uploads'));
const XML_DIR = path.join(UPLOADS_DIR, 'xml');
const PDF_DIR = path.join(UPLOADS_DIR, 'pdf');

/**
 * Carpetas IMAP donde buscar facturas electrónicas
 * Se busca en INBOX y en las variantes comunes de Spam/Junk
 */
const CARPETAS_BUSQUEDA = [
  'INBOX',
  '[Gmail]/Spam',           // Gmail
  '[Gmail]/Correo no deseado', // Gmail en español
  'Junk',                   // Genérico
  'Spam',                   // Genérico
  'Junk E-mail',            // Outlook
  'Bulk Mail',              // Yahoo
];

/**
 * Asegurar que existen los directorios de uploads
 */
function asegurarDirectoriosUploads() {
  for (const dir of [UPLOADS_DIR, XML_DIR, PDF_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Obtener las carpetas disponibles en el servidor IMAP
 */
async function obtenerCarpetasDisponibles() {
  const carpetasDisponibles = [];

  try {
    const listaMailboxes = await clienteIMAP.list();
    for (const mailbox of listaMailboxes) {
      carpetasDisponibles.push(mailbox.path);
    }
  } catch (err) {
    console.error('⚠️  Error listando carpetas IMAP:', err.message);
    // Fallback: solo INBOX
    carpetasDisponibles.push('INBOX');
  }

  return carpetasDisponibles;
}

/**
 * Determinar qué carpetas realmente existen para buscar
 */
async function carpetasParaBuscar() {
  const disponibles = await obtenerCarpetasDisponibles();
  const carpetasValidas = [];

  for (const carpeta of CARPETAS_BUSQUEDA) {
    // Buscar match exacto o match parcial (case insensitive)
    const encontrada = disponibles.find(d =>
      d === carpeta ||
      d.toLowerCase() === carpeta.toLowerCase() ||
      d.toLowerCase().endsWith(carpeta.toLowerCase())
    );
    if (encontrada && !carpetasValidas.includes(encontrada)) {
      carpetasValidas.push(encontrada);
    }
  }

  // Siempre incluir INBOX si no está
  if (!carpetasValidas.includes('INBOX')) {
    carpetasValidas.unshift('INBOX');
  }

  console.log(`📂 Carpetas IMAP a monitorear: ${carpetasValidas.join(', ')}`);
  return carpetasValidas;
}

/**
 * Iniciar el listener IMAP
 * @param {string} usuarioId - ID del usuario propietario del buzón
 */
async function iniciarListener(usuarioId) {
  if (reconectando) {
    console.log('⏳ Reconexión IMAP ya en curso, omitiendo...');
    return;
  }

  const config = configurarIMAP();

  if (!config.auth.user || !config.auth.pass) {
    console.warn('⚠️  Credenciales IMAP no configuradas. Listener de email desactivado.');
    return;
  }

  // Limpiar timers anteriores para evitar duplicados
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  asegurarDirectoriosUploads();
  reconectando = true;

  // Log de diagnóstico (sin password)
  console.log(`🔧 Config IMAP: host=${config.host}, port=${config.port}, secure=${config.secure}, user=${config.auth.user}`);

  try {
    clienteIMAP = new ImapFlow(config);

    clienteIMAP.on('error', (err) => {
      console.error('❌ Error IMAP:', err.message);
      conexionActiva = false;
    });

    clienteIMAP.on('close', () => {
      console.log('📧 Conexión IMAP cerrada');
      conexionActiva = false;
      lockIdle = null;
      // Reconectar automáticamente tras 30 segundos (si no hay otra en curso)
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          console.log('🔄 Intentando reconexión IMAP...');
          iniciarListener(usuarioId).catch(console.error);
        }, 30000);
      }
    });

    await clienteIMAP.connect();
    conexionActiva = true;
    reconectando = false;
    console.log('📧 Conectado al servidor IMAP exitosamente');

    // Procesar emails existentes no leídos al arrancar (en todas las carpetas)
    await procesarTodasLasCarpetas(usuarioId);

    // Iniciar modo IDLE para escucha en tiempo real (solo INBOX, IDLE no funciona en otras carpetas)
    escucharNuevosEmails(usuarioId).catch(err => {
      console.error('❌ Error en escucharNuevosEmails:', err.message);
    });

    // Sincronización periódica cada 30 minutos como fallback (por si IDLE falla)
    syncInterval = setInterval(() => {
      console.log('⏰ Sincronización periódica iniciada (fallback cada 30 min)');
      sincronizarManual(usuarioId).catch(err => {
        console.error('❌ Error en sincronización periódica:', err.message);
      });
    }, 30 * 60 * 1000);

  } catch (error) {
    logErrorDetallado('iniciarListener', error);
    conexionActiva = false;
    reconectando = false;
    intentosReconexion++;

    if (intentosReconexion >= MAX_INTENTOS_RECONEXION) {
      console.error(`🚨 Se alcanzó el máximo de ${MAX_INTENTOS_RECONEXION} intentos de reconexión. Deteniendo listener IMAP para evitar bucle infinito.`);
      console.error(`   Posibles causas: Contraseña de aplicación incorrecta, acceso IMAP desactivado en Gmail, o conexión bloqueada.`);
      return;
    }

    // Reintentar en 60 segundos si falla el arranque
    if (!reconnectTimeout) {
      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        iniciarListener(usuarioId).catch(console.error);
      }, 60000);
    }
  }
}

/**
 * Procesar emails no leídos en TODAS las carpetas configuradas
 */
async function procesarTodasLasCarpetas(usuarioId, buscarTodos = false, soloNoLeidos = false) {
  const carpetas = await carpetasParaBuscar();

  // Para sincronización rápida (solo no leídos), limitar a carpetas principales para mayor velocidad
  const carpetasAProcesar = soloNoLeidos 
    ? carpetas.filter(c => c === 'INBOX' || c.toLowerCase().includes('spam') || c.toLowerCase().includes('junk'))
    : carpetas;

  // Procesar carpetas en paralelo
  const promesas = carpetasAProcesar.map(carpeta => 
    procesarEmailsEnCarpeta(carpeta, usuarioId, buscarTodos, soloNoLeidos)
      .catch(err => console.error(`⚠️  Error procesando carpeta "${carpeta}": ${err.message}`))
  );

  await Promise.allSettled(promesas);

  ultimaSincronizacion = new Date();
}

/**
 * Procesar todos los emails no leídos de una carpeta específica
 */
async function procesarEmailsEnCarpeta(carpeta, usuarioId, buscarTodos = false, soloNoLeidos = false) {
  let lock;
  try {
    lock = await clienteIMAP.getMailboxLock(carpeta);
  } catch {
    // La carpeta no existe o no se puede abrir
    console.log(`  ⏩ Carpeta "${carpeta}" no accesible, omitiendo.`);
    return;
  }

  try {
    console.log(`📂 Procesando carpeta: ${carpeta} (buscarTodos: ${buscarTodos}, soloNoLeidos: ${soloNoLeidos})`);

    // Buscar mensajes de los últimos 60 días o no leídos
    const hace60Dias = new Date();
    hace60Dias.setDate(hace60Dias.getDate() - 60);
    hace60Dias.setHours(0, 0, 0, 0);

    let filtro;
    if (buscarTodos) {
      filtro = { all: true };
    } else if (soloNoLeidos) {
      filtro = { seen: false };
    } else {
      filtro = { or: [{ since: hace60Dias }, { seen: false }] };
    }

    // Paso 1: Obtener solo UIDs de los mensajes candidatos (consulta ligera)
    const mensajesInfo = clienteIMAP.fetch(filtro, { uid: true });
    const uidsCandidatos = [];
    for await (const msg of mensajesInfo) {
      if (msg.uid) {
        uidsCandidatos.push(msg.uid);
      }
    }

    console.log(`  🔍 ${uidsCandidatos.length} correo(s) candidato(s) encontrado(s) en "${carpeta}"`);

    if (uidsCandidatos.length === 0) {
      console.log(`  ℹ️  No hay correos en "${carpeta}" que coincidan con el filtro.`);
      return;
    }

    // Each attachment has its own durable identity; a partial email is never skipped.
    const uidsAProcesar = uidsCandidatos;

    if (uidsAProcesar.length === 0) {
      console.log(`  ℹ️  No hay nuevos correos para procesar en "${carpeta}" (de ${uidsCandidatos.length} analizados)`);
      return;
    }

    console.log(`  📨 Descargando y procesando ${uidsAProcesar.length} nuevo(s) correo(s) en "${carpeta}"...`);

    // Paso 3: Descargar y procesar en lotes con concurrencia controlada
    const TAMANO_LOTE = 20;
    const MAX_CONCURRENCY = 5;
    let procesados = 0;

    for (let i = 0; i < uidsAProcesar.length; i += TAMANO_LOTE) {
      const loteUids = uidsAProcesar.slice(i, i + TAMANO_LOTE);
      
      const mensajes = clienteIMAP.fetch(
        { uid: loteUids },
        {
          source: true,
          uid: true,
          envelope: true,
        }
      );

      const mensajesArray = [];
      for await (const msg of mensajes) {
        mensajesArray.push(msg);
      }

      // Procesar mensajes en paralelo con límite de concurrencia
      for (let j = 0; j < mensajesArray.length; j += MAX_CONCURRENCY) {
        const chunk = mensajesArray.slice(j, j + MAX_CONCURRENCY);
        const resultados = await Promise.allSettled(
          chunk.map(msg => procesarMensaje(msg, usuarioId, carpeta))
        );
        
        for (const resultado of resultados) {
          if (resultado.status === 'fulfilled') {
            procesados++;
          } else {
            console.error(`❌ Error procesando email en ${carpeta}:`, resultado.reason?.message || resultado.reason);
            estadisticas.errores++;
          }
        }
      }
    }

    if (procesados > 0) {
      console.log(`  ✅ ${procesados} email(s) procesado(s) en "${carpeta}"`);
    }
  } finally {
    lock.release();
  }
}

/**
 * Escuchar nuevos emails en tiempo real usando IDLE (solo INBOX)
 */
async function escucharNuevosEmails(usuarioId) {
  try {
    pausandoIdle = false;
    lockIdle = await clienteIMAP.getMailboxLock('INBOX');
    console.log('👂 Escuchando nuevos emails en modo IDLE (INBOX)...');

    // Escuchar evento de nuevo email
    clienteIMAP.on('exists', async (data) => {
      console.log(`📬 Nuevo email detectado en INBOX! Mensajes totales: ${data.count}`);
      
      // Pausamos IDLE liberando el lock para permitir operaciones de fetch
      pausandoIdle = true;
      try {
        await liberarLockIdle();
        // Procesamos solo no leídos para mayor velocidad
        await procesarEmailsEnCarpeta('INBOX', usuarioId, false, true);
      } catch (err) {
        console.error('❌ Error procesando nuevo email en IDLE:', err.message);
      } finally {
        pausandoIdle = false;
        await restablecerLockIdle();
      }
    });

    // Mantener la función activa escuchando indefinidamente
    await new Promise((resolve, reject) => {
      clienteIMAP.on('close', () => {
        console.log('📧 Evento close en IDLE, deteniendo escucha...');
        resolve();
      });
      clienteIMAP.on('error', (err) => {
        console.error('❌ Evento error en IDLE:', err.message);
        reject(err);
      });
    });

  } catch (error) {
    console.error('❌ Error en listener de modo IDLE:', error.message);
  } finally {
    await liberarLockIdle();
  }
}

/**
 * Procesar un mensaje individual
 * @param {object} msg - Mensaje IMAP
 * @param {string} usuarioId - ID del usuario
 * @param {string} carpeta - Nombre de la carpeta IMAP de origen
 */
async function procesarMensaje(msg, usuarioId, carpeta = 'INBOX') {
  const parsed = await simpleParser(msg.source);
  const { xmls, pdfs } = await extraerContenidoFactura(parsed);
  const destino = parsed.to?.value?.[0]?.address || '';
  estadisticas.emailsProcesados++;
  for (const pdf of pdfs) {
    await inbox.recibir({ eventKey: `pdf:${destino}:${inbox.hash(pdf.buffer)}`, canal: 'pdf_pendiente', estado: 'sin_asignar',
      payload: { emailDestino: destino, nombre: pdf.nombre, buffer: pdf.buffer } });
  }
  for (const xml of xmls) {
    const clave = xml.match(/<(?:\w+:)?Clave>\s*(\d{50})\s*<\//)?.[1];
    const candidatos = clave ? pdfs.filter(p => p.nombre.includes(clave) || p.buffer.includes(Buffer.from(clave))) : [];
    const evento = await inbox.recibir({ eventKey: `email:${destino}:${inbox.hash(xml)}`, canal: 'email', payload: {
      xml, pdfBuffer: candidatos.length === 1 ? candidatos[0].buffer : null,
      opciones: { ...(usuarioId ? { usuarioId } : {}), emailDestino: destino, emailUID: `${carpeta}_${msg.uid}`, canal: 'imap' },
    } });
    const resultado = await inbox.procesar(evento._id);
    if (resultado.resultado?.exito && !resultado.resultado?.duplicada) estadisticas.facturasCreadas++;
  }
  // Inbox persistence precedes acknowledgement. Pending processing survives restart.
  if (clienteIMAP) await clienteIMAP.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
}

/**
 * Forzar sincronización manual (busca en todas las carpetas)
 * Si no hay conexión activa, intenta reconectar automáticamente
 */
async function sincronizarManual(usuarioId, opciones = {}) {
  const soloNoLeidos = opciones.soloNoLeidos === true;

  // Si no hay conexión, intentar reconectar
  if (!clienteIMAP || !conexionActiva) {
    console.log('🔄 Reconectando IMAP para sincronización manual...');
    const config = configurarIMAP();
    if (!config.auth.user || !config.auth.pass) {
      throw new Error('Credenciales IMAP no configuradas');
    }
    try {
      // Cerrar conexión anterior si existe
      if (clienteIMAP) {
        try { await clienteIMAP.logout(); } catch (err) {
          console.warn('Error cerrando cliente IMAP previo:', err.message);
        }
      }
      clienteIMAP = new ImapFlow(config);
      clienteIMAP.on('error', (err) => {
        console.error('❌ Error IMAP:', err.message);
        conexionActiva = false;
      });
      await clienteIMAP.connect();
      conexionActiva = true;
      asegurarDirectoriosUploads();
      console.log('📧 Reconectado a IMAP exitosamente');
    } catch (err) {
      conexionActiva = false;
      const error = new Error(`No se pudo conectar al servidor IMAP: ${err.message}`);
      error.cause = err;
      throw error;
    }
  }

  // Pausar IDLE para evitar colisiones de locks en INBOX
  pausandoIdle = true;
  await liberarLockIdle();

  try {
    await procesarTodasLasCarpetas(usuarioId, false, soloNoLeidos);
  } finally {
    pausandoIdle = false;
    await restablecerLockIdle();
  }

  return {
    mensaje: 'Sincronización completada',
    fecha: new Date(),
    estadisticas: { ...estadisticas },
  };
}

/**
 * Obtener estado del servicio
 */
function obtenerEstado() {
  return {
    conectado: conexionActiva,
    ultimaSincronizacion,
    host: process.env.IMAP_HOST || 'No configurado',
    usuario: process.env.IMAP_USER
      ? process.env.IMAP_USER.replace(/(.{3}).*(@.*)/, '$1***$2')
      : 'No configurado',
    carpetasMonitoreadas: CARPETAS_BUSQUEDA.slice(0, 3),
    estadisticas: { ...estadisticas },
  };
}

/**
 * Detener el listener
 */
async function detenerListener() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (clienteIMAP) {
    try {
      await clienteIMAP.logout();
    } catch (err) {
      console.warn('Error cerrando cliente IMAP:', err.message);
    }
    clienteIMAP = null;
    conexionActiva = false;
    console.log('📧 Listener IMAP detenido');
  }
}

module.exports = {
  procesarMensaje,
  iniciarListener,
  sincronizarManual,
  obtenerEstado,
  detenerListener,
};
