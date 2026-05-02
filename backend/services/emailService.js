/**
 * Servicio de Email IMAP — Escucha y descarga de facturas electrónicas
 * Usa ImapFlow (moderno, async/await, soporte IDLE nativo)
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

// Directorio para guardar archivos adjuntos
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * Asegurar que existe el directorio de uploads
 */
function asegurarDirectorioUploads() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
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

  asegurarDirectorioUploads();

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

    // Procesar emails existentes no leídos al arrancar
    await procesarEmailsNoLeidos(usuarioId);

    // Iniciar modo IDLE para escucha en tiempo real
    await escucharNuevosEmails(usuarioId);
  } catch (error) {
    console.error('❌ Error iniciando listener IMAP:', error.message);
    conexionActiva = false;
  }
}

/**
 * Procesar todos los emails no leídos del INBOX
 */
async function procesarEmailsNoLeidos(usuarioId) {
  try {
    const lock = await clienteIMAP.getMailboxLock('INBOX');

    try {
      // Buscar mensajes no leídos
      const mensajes = clienteIMAP.fetch({ seen: false }, {
        source: true,
        uid: true,
        envelope: true,
      });

      let procesados = 0;

      for await (const msg of mensajes) {
        try {
          await procesarMensaje(msg, usuarioId);
          procesados++;
        } catch (err) {
          console.error(`❌ Error procesando email UID ${msg.uid}:`, err.message);
        }
      }

      if (procesados > 0) {
        console.log(`✅ ${procesados} email(s) procesado(s) en sincronización`);
      }

      ultimaSincronizacion = new Date();
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('❌ Error procesando emails no leídos:', error.message);
  }
}

/**
 * Escuchar nuevos emails en tiempo real usando IDLE
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
            await procesarMensaje(msg, usuarioId);
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
 */
async function procesarMensaje(msg, usuarioId) {
  const uid = String(msg.uid);

  // Verificar idempotencia: ¿ya procesamos este email?
  const yaExiste = await Factura.findOne({ emailUID: uid, usuario: usuarioId });
  if (yaExiste) {
    return; // Ya fue procesado
  }

  // Parsear el email completo
  const parsed = await simpleParser(msg.source);
  console.log(`📨 Procesando: "${parsed.subject}" de ${parsed.from?.text || 'desconocido'}`);

  // Buscar adjuntos XML y PDF
  const adjuntos = parsed.attachments || [];
  let xmlEncontrado = null;
  let pdfGuardado = null;

  for (const adjunto of adjuntos) {
    const nombre = (adjunto.filename || '').toLowerCase();
    const tipo = (adjunto.contentType || '').toLowerCase();

    if (nombre.endsWith('.xml') || tipo.includes('xml')) {
      xmlEncontrado = adjunto;
    }

    if (nombre.endsWith('.pdf') || tipo.includes('pdf')) {
      // Guardar PDF en disco
      const nombreArchivo = `${uid}_${adjunto.filename || 'factura.pdf'}`;
      const rutaPDF = path.join(UPLOADS_DIR, nombreArchivo);
      fs.writeFileSync(rutaPDF, adjunto.content);
      pdfGuardado = rutaPDF;
    }
  }

  // Si no hay XML, no podemos procesar como factura electrónica
  if (!xmlEncontrado) {
    console.log(`  ⏩ Email sin XML de factura, omitiendo.`);
    // Marcar como leído igualmente
    try {
      await clienteIMAP.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
    } catch (e) { /* ignorar */ }
    return;
  }

  // Parsear el XML
  const xmlString = xmlEncontrado.content.toString('utf-8');
  let datosFactura;

  try {
    datosFactura = parsearFacturaXML(xmlString);
  } catch (error) {
    console.error(`  ❌ Error parseando XML: ${error.message}`);
    // Guardar factura con estado error
    await Factura.create({
      fechaEmision: new Date(),
      emisor: { nombre: parsed.from?.text || 'Error de parsing' },
      resumenFactura: {},
      estado: 'error',
      emailUID: uid,
      usuario: usuarioId,
    });
    return;
  }

  // Guardar XML en disco
  const nombreXML = `${uid}_${xmlEncontrado.filename || 'factura.xml'}`;
  const rutaXML = path.join(UPLOADS_DIR, nombreXML);
  fs.writeFileSync(rutaXML, xmlEncontrado.content);

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
    archivoPDF: pdfGuardado || '',
    emailUID: uid,
    estado: 'procesada',
    usuario: usuarioId,
  });

  console.log(`  ✅ Factura procesada: ${datosFactura.emisor?.nombre} — ₡${datosFactura.resumenFactura?.totalComprobante} [${categorizacion.categoriaIA}]`);

  // Marcar email como leído
  try {
    await clienteIMAP.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
  } catch (e) { /* ignorar errores de flags */ }
}

/**
 * Forzar sincronización manual
 */
async function sincronizarManual(usuarioId) {
  if (!clienteIMAP || !conexionActiva) {
    throw new Error('El servicio de email no está conectado');
  }
  await procesarEmailsNoLeidos(usuarioId);
  return { mensaje: 'Sincronización completada', fecha: new Date() };
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
