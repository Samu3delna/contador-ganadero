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
  const config = configurarIMAP();

  if (!config.auth.user || !config.auth.pass) {
    console.warn('⚠️  Credenciales IMAP no configuradas. Listener de email desactivado.');
    return;
  }

  asegurarDirectoriosUploads();

  try {
    clienteIMAP = new ImapFlow(config);

    clienteIMAP.on('error', (err) => {
      console.error('❌ Error IMAP:', err.message);
      conexionActiva = false;
    });

    clienteIMAP.on('close', () => {
      console.log('📧 Conexión IMAP cerrada');
      conexionActiva = false;
      // Reconectar automáticamente tras 30 segundos
      setTimeout(() => {
        console.log('🔄 Intentando reconexión IMAP...');
        iniciarListener(usuarioId).catch(console.error);
      }, 30000);
    });

    await clienteIMAP.connect();
    conexionActiva = true;
    console.log('📧 Conectado al servidor IMAP exitosamente');

    // Procesar emails existentes no leídos al arrancar (en todas las carpetas)
    await procesarTodasLasCarpetas(usuarioId);

    // Iniciar modo IDLE para escucha en tiempo real (solo INBOX, IDLE no funciona en otras carpetas)
    await escucharNuevosEmails(usuarioId);
  } catch (error) {
    console.error('❌ Error iniciando listener IMAP:', error.message);
    conexionActiva = false;
  }
}

/**
 * Procesar emails no leídos en TODAS las carpetas configuradas
 */
async function procesarTodasLasCarpetas(usuarioId) {
  const carpetas = await carpetasParaBuscar();

  for (const carpeta of carpetas) {
    try {
      await procesarEmailsEnCarpeta(carpeta, usuarioId);
    } catch (err) {
      console.error(`⚠️  Error procesando carpeta "${carpeta}": ${err.message}`);
    }
  }

  ultimaSincronizacion = new Date();
}

/**
 * Procesar todos los emails no leídos de una carpeta específica
 */
async function procesarEmailsEnCarpeta(carpeta, usuarioId) {
  let lock;
  try {
    lock = await clienteIMAP.getMailboxLock(carpeta);
  } catch (err) {
    // La carpeta no existe o no se puede abrir
    console.log(`  ⏩ Carpeta "${carpeta}" no accesible, omitiendo.`);
    return;
  }

  try {
    console.log(`📂 Procesando carpeta: ${carpeta}`);

    // Buscar mensajes de hoy en adelante
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mensajes = clienteIMAP.fetch({ since: hoy }, {
      source: true,
      uid: true,
      envelope: true,
    });

    let procesados = 0;

    for await (const msg of mensajes) {
      try {
        await procesarMensaje(msg, usuarioId, carpeta);
        procesados++;
      } catch (err) {
        console.error(`❌ Error procesando email UID ${msg.uid} en ${carpeta}:`, err.message);
        estadisticas.errores++;
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
    const lock = await clienteIMAP.getMailboxLock('INBOX');

    try {
      // Escuchar evento de nuevo email
      clienteIMAP.on('exists', async (data) => {
        console.log('📬 Nuevo email detectado!');
        try {
          // Buscar el último email no leído
          const mensajes = clienteIMAP.fetch({ seen: false }, {
            source: true,
            uid: true,
            envelope: true,
          });

          for await (const msg of mensajes) {
            await procesarMensaje(msg, usuarioId, 'INBOX');
          }
        } catch (err) {
          console.error('❌ Error procesando nuevo email:', err.message);
        }
      });

      // Mantener la conexión IDLE
      console.log('👂 Escuchando nuevos emails en modo IDLE...');
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('❌ Error en modo IDLE:', error.message);
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
      pdfsGuardados.push(rutaPDF);
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
    const rutaXML = path.join(XML_DIR, nombreXML);
    fs.writeFileSync(rutaXML, xmlAdjunto.content);
    estadisticas.xmlsDescargados++;
    console.log(`  💾 XML guardado: ${rutaXML}`);

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
 */
async function sincronizarManual(usuarioId) {
  if (!clienteIMAP || !conexionActiva) {
    throw new Error('El servicio de email no está conectado');
  }
  await procesarTodasLasCarpetas(usuarioId);
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
