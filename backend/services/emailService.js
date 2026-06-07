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
const { parsearFacturaXML } = require('./xmlParserService');
const { categorizarFactura } = require('./aiService');
const Factura = require('../models/Factura');

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
    } catch (_) {}
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
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
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
async function procesarTodasLasCarpetas(usuarioId, buscarTodos = false) {
  const carpetas = await carpetasParaBuscar();

  for (const carpeta of carpetas) {
    try {
      await procesarEmailsEnCarpeta(carpeta, usuarioId, buscarTodos);
    } catch (err) {
      console.error(`⚠️  Error procesando carpeta "${carpeta}": ${err.message}`);
    }
  }

  ultimaSincronizacion = new Date();
}

/**
 * Procesar todos los emails no leídos de una carpeta específica
 */
async function procesarEmailsEnCarpeta(carpeta, usuarioId, buscarTodos = false) {
  let lock;
  try {
    lock = await clienteIMAP.getMailboxLock(carpeta);
  } catch (err) {
    // La carpeta no existe o no se puede abrir
    console.log(`  ⏩ Carpeta "${carpeta}" no accesible, omitiendo.`);
    return;
  }

  try {
    console.log(`📂 Procesando carpeta: ${carpeta} (buscarTodos: ${buscarTodos})`);

    // Buscar mensajes de los últimos 60 días o no leídos
    const hace60Dias = new Date();
    hace60Dias.setDate(hace60Dias.getDate() - 60);
    hace60Dias.setHours(0, 0, 0, 0);

    const filtro = buscarTodos
      ? { all: true }
      : { or: [{ since: hace60Dias }, { seen: false }] };

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

    // Paso 2: Filtrar contra la base de datos para omitir correos ya procesados
    const emailUIDsCandidatos = uidsCandidatos.map(uid => `${carpeta}_${uid}`);
    const facturasExistentes = await Factura.find({
      usuario: usuarioId,
      emailUID: { $in: emailUIDsCandidatos }
    }).distinct('emailUID');

    const setUidsExistentes = new Set(
      facturasExistentes.map(emailUidStr => {
        const parts = emailUidStr.split('_');
        return parseInt(parts[parts.length - 1], 10);
      })
    );

    const uidsAProcesar = uidsCandidatos.filter(uid => !setUidsExistentes.has(uid));

    console.log(`  🗃️  ${facturasExistentes.length} ya procesado(s), ${uidsAProcesar.length} nuevo(s) para procesar`);

    if (uidsAProcesar.length === 0) {
      console.log(`  ℹ️  No hay nuevos correos para procesar en "${carpeta}" (de ${uidsCandidatos.length} analizados)`);
      return;
    }

    console.log(`  📨 Descargando y procesando ${uidsAProcesar.length} nuevo(s) correo(s) en "${carpeta}"...`);

    // Paso 3: Descargar y procesar en lotes (batching) de 50 para evitar sobrecarga
    const TAMANO_LOTE = 50;
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

      for await (const msg of mensajes) {
        try {
          await procesarMensaje(msg, usuarioId, carpeta);
          procesados++;
        } catch (err) {
          console.error(`❌ Error procesando email UID ${msg.uid} en ${carpeta}:`, err.message);
          estadisticas.errores++;
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
        // Esperamos un segundo para asegurar que el correo esté disponible
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Procesamos los correos de la bandeja
        await procesarEmailsEnCarpeta('INBOX', usuarioId);
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
  const uid = `${carpeta}_${String(msg.uid)}`;

  // Verificar idempotencia: ¿ya procesamos este email?
  const yaExiste = await Factura.findOne({ emailUID: uid, usuario: usuarioId });
  if (yaExiste) {
    return; // Ya fue procesado
  }

  // Parsear el email completo
  const parsed = await simpleParser(msg.source);
  console.log(`📨 Procesando: "${parsed.subject}" de ${parsed.from?.text || 'desconocido'} [${carpeta}]`);

  estadisticas.emailsProcesados++;

  // ====================================================
  // BUSCAR ADJUNTOS XML ESPECÍFICAMENTE
  // ====================================================
  const adjuntos = parsed.attachments || [];
  let xmlsEncontrados = [];
  let pdfsGuardados = [];

  for (const adjunto of adjuntos) {
    const nombre = (adjunto.filename || '').toLowerCase();
    const tipo = (adjunto.contentType || '').toLowerCase();

    // Buscar archivos .xml explícitamente
    if (nombre.endsWith('.xml') || tipo.includes('xml') || tipo.includes('text/xml') || tipo.includes('application/xml')) {
      // Filtrar XMLs que NO son facturas (confirmaciones de Hacienda, respuestas, etc.)
      if (!nombre.startsWith('confirmacion') && !nombre.includes('mensajehacienda') && !nombre.includes('respuesta')) {
        xmlsEncontrados.push(adjunto);
      } else {
        console.log(`  ⏩ Adjunto "${adjunto.filename}" es confirmación de Hacienda, omitiendo.`);
      }
    }

    // Guardar PDFs
    if (nombre.endsWith('.pdf') || tipo.includes('pdf')) {
      const nombreArchivo = `${Date.now()}_${adjunto.filename || 'factura.pdf'}`;
      const rutaPDF = path.join(PDF_DIR, nombreArchivo);
      fs.writeFileSync(rutaPDF, adjunto.content);
      // Guardar ruta RELATIVA para que funcione en cualquier entorno
      pdfsGuardados.push(path.join('uploads', 'pdf', nombreArchivo));
    }
  }

  // Si no hay XML en adjuntos, buscar en el cuerpo del email (algunos proveedores embeden XML)
  if (xmlsEncontrados.length === 0 && parsed.html) {
    // Intentar extraer XML del body si viene como attachment inline
    const xmlRegex = /<\?xml[\s\S]*?<\/(?:FacturaElectronica|NotaCreditoElectronica|TiqueteElectronico)>/gi;
    const xmlMatch = parsed.html.match(xmlRegex);
    if (xmlMatch) {
      xmlsEncontrados.push({
        filename: 'factura_embebida.xml',
        content: Buffer.from(xmlMatch[0], 'utf-8'),
      });
    }
  }

  // Si no hay XML, no podemos procesar como factura electrónica
  if (xmlsEncontrados.length === 0) {
    console.log(`  ⏩ Email sin XML de factura, omitiendo.`);
    // Marcar como leído igualmente
    try {
      await clienteIMAP.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
    } catch (e) { /* ignorar */ }
    return;
  }

  // ====================================================
  // PROCESAR CADA XML ENCONTRADO
  // ====================================================
  for (const xmlAdjunto of xmlsEncontrados) {
    const xmlString = xmlAdjunto.content.toString('utf-8');
    // Guardar XML en disco ANTES de parsear
    const nombreXML = `${Date.now()}_${xmlAdjunto.filename || 'factura.xml'}`;
    const rutaAbsolutaXML = path.join(XML_DIR, nombreXML);
    fs.writeFileSync(rutaAbsolutaXML, xmlAdjunto.content);
    // Guardar ruta RELATIVA para que funcione en cualquier entorno
    const rutaXML = path.join('uploads', 'xml', nombreXML);
    estadisticas.xmlsDescargados++;
    console.log(`  💾 XML guardado: ${rutaAbsolutaXML}`);

    let datosFactura;

    try {
      datosFactura = parsearFacturaXML(xmlString);
    } catch (error) {
      console.error(`  ❌ Error parseando XML "${xmlAdjunto.filename}": ${error.message}`);
      estadisticas.errores++;
      // Guardar factura con estado error
      await Factura.create({
        fechaEmision: new Date(),
        emisor: { nombre: parsed.from?.text || 'Error de parsing' },
        resumenFactura: {},
        estado: 'error',
        emailUID: uid,
        carpetaOrigen: carpeta,
        archivoXML: rutaXML,
        usuario: usuarioId,
      });
      continue;
    }

    // Verificar si ya existe por clave numérica (evitar duplicados de XML diferentes)
    if (datosFactura.claveNumerica) {
      const existePorClave = await Factura.findOne({
        claveNumerica: datosFactura.claveNumerica,
        usuario: usuarioId,
      });
      if (existePorClave) {
        console.log(`  ⏩ Factura ${datosFactura.claveNumerica} ya existe, omitiendo.`);
        continue;
      }
    }

    // ====================================================
    // MOSTRAR ALERTAS DE TARIFA EN CONSOLA
    // ====================================================
    if (datosFactura.alertasTarifa && datosFactura.alertasTarifa.length > 0) {
      console.log(`  🚨 ALERTAS DE TARIFA (${datosFactura.alertasTarifa.length}):`);
      for (const alerta of datosFactura.alertasTarifa) {
        console.log(`     ${alerta.mensaje}`);
        estadisticas.alertasTarifa++;
      }
      if (datosFactura.resumenValidacionTarifa.ahorrosPerdidos > 0) {
        console.log(`     💸 Ahorros perdidos estimados: ₡${datosFactura.resumenValidacionTarifa.ahorrosPerdidos.toLocaleString('es-CR')}`);
      }
    }

    // Categorizar con IA
    let categorizacion;
    try {
      categorizacion = await categorizarFactura(datosFactura);
    } catch (error) {
      console.error(`  ⚠️ Error en categorización IA: ${error.message}`);
      categorizacion = {
        categoriaIA: 'sin_clasificar',
        subcategoriaIA: 'Error en categorización',
        esDeducible: true,
        justificacionIA: '',
        confianzaIA: 0,
      };
    }

    // Crear factura en la base de datos
    const factura = await Factura.create({
      ...datosFactura,
      ...categorizacion,
      archivoXML: rutaXML,
      archivoPDF: pdfsGuardados[0] || '',
      emailUID: uid,
      carpetaOrigen: carpeta,
      estado: datosFactura.alertasTarifa?.some(a => a.severidad === 'error') ? 'revision' : 'procesada',
      usuario: usuarioId,
    });

    estadisticas.facturasCreadas++;

    const estadoLabel = factura.estado === 'revision' ? '⚠️ REVISIÓN' : '✅ OK';
    console.log(`  ${estadoLabel} Factura procesada: ${datosFactura.emisor?.nombre} — ₡${datosFactura.resumenFactura?.totalComprobante} [${categorizacion.categoriaIA}]`);
  }

  // Marcar email como leído
  try {
    await clienteIMAP.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
  } catch (e) { /* ignorar errores de flags */ }
}

/**
 * Forzar sincronización manual (busca en todas las carpetas)
 * Si no hay conexión activa, intenta reconectar automáticamente
 */
async function sincronizarManual(usuarioId) {
  if (!usuarioId) {
    throw new Error('usuarioId es requerido para sincronizar');
  }

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
        try { await clienteIMAP.logout(); } catch (_) {}
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
      throw new Error(`No se pudo conectar al servidor IMAP: ${err.message}`);
    }
  }

  // Pausar IDLE para evitar colisiones de locks en INBOX
  pausandoIdle = true;
  await liberarLockIdle();

  try {
    await procesarTodasLasCarpetas(usuarioId, true);
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
    } catch (e) { /* ignorar */ }
    clienteIMAP = null;
    conexionActiva = false;
    console.log('📧 Listener IMAP detenido');
  }
}

module.exports = {
  iniciarListener,
  sincronizarManual,
  obtenerEstado,
  detenerListener,
};
