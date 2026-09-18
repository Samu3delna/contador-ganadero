const fs = require('fs');
const path = require('path');
const { parsearFacturaXML } = require('./xmlParserService');
const { categorizarFactura } = require('./aiService');
const Factura = require('../models/Factura');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.join(__dirname, '..', 'uploads');
const XML_DIR = path.join(UPLOAD_ROOT, 'xml');
const PDF_DIR = path.join(UPLOAD_ROOT, 'pdf');

function asegurarDirectorios() {
  if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  if (!fs.existsSync(XML_DIR)) fs.mkdirSync(XML_DIR, { recursive: true });
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
}

/**
 * Busca el Usuario y Tenant destinatario usando múltiples estrategias:
 * 1. Cédula del receptor extraída del XML (la más confiable en Costa Rica)
 * 2. ID explícito de usuario o tenant
 * 3. Email alias del tenant (ej: finca-esperanza@contadorganandero.com)
 * 4. Número de teléfono (para WhatsApp)
 */
async function resolverDestinatario({ cedulaReceptor, usuarioId, tenantId, emailDestino, telefono }) {
  // 1. Por ID directo si ya se conoce
  if (usuarioId) {
    const u = await Usuario.findById(usuarioId);
    if (u) {
      return { usuario: u, tenantId: u.tenantId || tenantId };
    }
  }

  // 2. Por alias de email del Tenant o sufijo (Cloudflare Email Routing)
  if (emailDestino) {
    const alias = emailDestino.split('@')[0].toLowerCase().trim();

    // 2a. Coincidencia exacta con emailAlias del Tenant
    let tenant = await Tenant.findOne({ emailAlias: alias });

    // 2b. Coincidencia por sufijo de 4 caracteres (ej: "finca-af2e", "pepe-af2e", "af2e")
    if (!tenant) {
      const matchSuffix = alias.match(/-?([a-f0-9]{4})$/i);
      if (matchSuffix) {
        const suffix = matchSuffix[1].toLowerCase();
        // Buscar tenant cuyo emailAlias termine con ese sufijo
        tenant = await Tenant.findOne({ emailAlias: { $regex: suffix + '$', $options: 'i' } });

        // Si no, buscar tenant cuyo ID termine con ese sufijo
        if (!tenant) {
          const allTenants = await Tenant.find({}, '_id');
          const matchedTenant = allTenants.find(t => t._id.toString().toLowerCase().endsWith(suffix));
          if (matchedTenant) tenant = await Tenant.findById(matchedTenant._id);
        }

        // Si no, buscar usuario cuyo ID termine con ese sufijo
        if (!tenant) {
          const allUsers = await Usuario.find({}, '_id tenantId');
          const matchedUser = allUsers.find(u => u._id.toString().toLowerCase().endsWith(suffix));
          if (matchedUser) {
            const u = await Usuario.findById(matchedUser._id);
            if (u) return { usuario: u, tenantId: u.tenantId };
          }
        }
      }
    }

    // 2c. Si el alias coincide con el nombre/slug de la finca
    if (!tenant) {
      const cleanAlias = alias.replace(/^finca-/, '');
      tenant = await Tenant.findOne({
        emailAlias: { $regex: cleanAlias, $options: 'i' },
      });
    }

    if (tenant) {
      const u = await Usuario.findOne({ tenantId: tenant._id, rol: 'dueño' }) || await Usuario.findOne({ tenantId: tenant._id });
      if (u) return { usuario: u, tenantId: tenant._id };
    }

    // 2d. Coincidencia por prefijo del correo registrado del usuario (ej: samu3delgado@...)
    const uByEmail = await Usuario.findOne({ email: { $regex: '^' + alias + '@', $options: 'i' } });
    if (uByEmail) {
      return { usuario: uByEmail, tenantId: uByEmail.tenantId };
    }
  }

  // 3. Por Cédula del receptor (crucial en XML costarricense)
  if (cedulaReceptor) {
    const cedulaLimpia = String(cedulaReceptor).replace(/[-\s]/g, '').trim();
    const cedulaSinCeros = cedulaLimpia.replace(/^0+/, '');
    const u = await Usuario.findOne({
      $or: [
        { 'cedula.numero': cedulaLimpia },
        { 'cedula.numero': cedulaSinCeros },
        { 'cedula.numero': '0' + cedulaSinCeros },
        { 'cedula.numero': String(cedulaReceptor).trim() },
      ],
    });
    if (u) {
      return { usuario: u, tenantId: u.tenantId };
    }
  }

  // 4. Por teléfono del usuario (WhatsApp Bot)
  if (telefono) {
    const telLimpio = String(telefono).replace(/\D/g, '');
    const u = await Usuario.findOne({
      $or: [
        { telefono: telLimpio },
        { telefono: { $regex: telLimpio.slice(-8) + '$' } }, // Match últimos 8 dígitos (CR)
      ],
    });
    if (u) {
      return { usuario: u, tenantId: u.tenantId };
    }
  }

  return { usuario: null, tenantId: null };
}


/**
 * Procesa un XML de factura electrónica y lo guarda en la base de datos
 */
async function procesarFacturaXMLString(xmlContent, opciones = {}) {
  asegurarDirectorios();

  const xmlString = typeof xmlContent === 'string' ? xmlContent : xmlContent.toString('utf-8');

  // Ignorar acuses de recibo de Hacienda (MensajeHacienda)
  if (xmlString.includes('<MensajeHacienda') || xmlString.includes(':MensajeHacienda')) {
    return { ignorada: true, motivo: 'MensajeHacienda (acuse de recibo, no es factura)' };
  }

  // Parsear el XML
  const datosFactura = parsearFacturaXML(xmlString);
  if (!datosFactura || !datosFactura.claveNumerica) {
    throw new Error('El XML no contiene una factura electrónica válida con Clave de Hacienda.');
  }

  // Resolver destinatario
  const cedulaReceptor = datosFactura.receptor?.cedula?.numero;
  const { usuario, tenantId } = await resolverDestinatario({
    cedulaReceptor,
    usuarioId: opciones.usuarioId,
    tenantId: opciones.tenantId,
    emailDestino: opciones.emailDestino,
    telefono: opciones.telefono,
  });

  if (!usuario) {
    console.warn(`⚠️ [Ingesta Email] Factura no asignada. Clave: ${datosFactura.claveNumerica}, Receptor: ${cedulaReceptor || 'N/A'}, Destino: ${opciones.emailDestino || 'N/A'}`);
    return {
      exito: false,
      noAsignada: true,
      claveNumerica: datosFactura.claveNumerica,
      cedulaReceptor: cedulaReceptor || 'No indicada',
      mensaje: `No se encontró ningún usuario o finca registrada con la cédula receptor ${cedulaReceptor || 'desconocida'} ni con el correo destino ${opciones.emailDestino || ''}.`,
    };
  }

  // Verificar si ya existe en la BD (idempotencia)
  const yaExiste = await Factura.findOne({
    claveNumerica: datosFactura.claveNumerica,
    $or: [{ usuario: usuario._id }, { tenantId: tenantId || usuario.tenantId }],
  });

  if (yaExiste) {
    return {
      exito: true,
      duplicada: true,
      factura: yaExiste,
      mensaje: `Factura ${datosFactura.claveNumerica} ya estaba registrada.`,
    };
  }

  // Guardar archivo XML en disco
  const nombreXML = `${Date.now()}_${datosFactura.claveNumerica}.xml`;
  const rutaAbsolutaXML = path.join(XML_DIR, nombreXML);
  fs.writeFileSync(rutaAbsolutaXML, xmlString);
  const rutaRelativaXML = path.join('uploads', 'xml', nombreXML);

  // Guardar PDF adjunto si vino en opciones
  let rutaRelativaPDF = null;
  if (opciones.pdfBuffer) {
    const nombrePDF = `${Date.now()}_${datosFactura.claveNumerica}.pdf`;
    const rutaAbsolutaPDF = path.join(PDF_DIR, nombrePDF);
    fs.writeFileSync(rutaAbsolutaPDF, opciones.pdfBuffer);
    rutaRelativaPDF = path.join('uploads', 'pdf', nombrePDF);
  }

  // Categorización con IA (NVIDIA NIM)
  let categorizacion = { categoria: 'sin_clasificar', confianza: 0.5, justificacion: 'Pendiente de análisis' };
  try {
    categorizacion = await categorizarFactura(datosFactura);
  } catch (err) {
    console.warn('⚠️ Error al categorizar factura con IA:', err.message);
  }

  // Resumen de validación de tarifas
  const alertasTarifa = datosFactura.alertasTarifa || [];
  const resumenTarifa = datosFactura.resumenValidacionTarifa || {
    totalLineas: datosFactura.detalle?.length || 0,
    alertasError: alertasTarifa.filter(a => a.severidad === 'error').length,
    alertasAdvertencia: alertasTarifa.filter(a => a.severidad === 'advertencia').length,
    lineasOk: alertasTarifa.filter(a => a.severidad === 'ok').length,
    ahorrosPerdidos: alertasTarifa.reduce((sum, a) => sum + (a.diferenciaIVA || 0), 0),
  };

  const fechaEmision = datosFactura.fechaEmision ? new Date(datosFactura.fechaEmision) : new Date();

  // Crear registro en MongoDB
  const nuevaFactura = await Factura.create({
    claveNumerica: datosFactura.claveNumerica,
    consecutivo: datosFactura.consecutivo,
    fechaEmision,
    emisor: datosFactura.emisor,
    receptor: datosFactura.receptor,
    lineaDetalle: datosFactura.detalle || [],
    resumenFactura: datosFactura.resumenFactura || {},
    otrosCargos: datosFactura.otrosCargos || [],
    categoriaIA: categorizacion.categoria,
    confianzaIA: categorizacion.confianza,
    justificacionIA: categorizacion.justificacion,
    categoriaManual: categorizacion.categoria,
    alertasTarifa,
    resumenValidacionTarifa: resumenTarifa,
    cuatrimestre: datosFactura.cuatrimestre || 1,
    periodoFiscal: datosFactura.periodoFiscal || fechaEmision.getFullYear(),
    archivoXML: rutaRelativaXML,
    archivoPDF: rutaRelativaPDF,
    emailUID: opciones.emailUID,
    carpetaOrigen: opciones.canal || 'webhook',
    estado: resumenTarifa.alertasError > 0 ? 'revision' : 'procesada',
    esDeducible: true,
    tenantId: tenantId || usuario.tenantId,
    usuario: usuario._id,
  });

  return {
    exito: true,
    duplicada: false,
    factura: nuevaFactura,
    usuario,
    emisor: datosFactura.emisor?.nombre || 'Emisor desconocido',
    total: datosFactura.resumenFactura?.totalComprobante || 0,
    alertas: resumenTarifa.alertasError,
  };
}

module.exports = {
  procesarFacturaXMLString,
  resolverDestinatario,
  asegurarDirectorios,
};
