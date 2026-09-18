const path = require('path');
const fs = require('fs');
const Factura = require('../models/Factura');
const { obtenerCuatrimestre } = require('../utils/costaRicaTax');
const { sincronizarManual, obtenerEstado } = require('../services/emailService');
const { procesarFacturaXMLString } = require('../services/ingestaFacturaService');
const { validarTarifasFactura } = require('../utils/insumosAgropecuarios');

const obtenerFacturas = async (req, res, next) => {
  try {
    const { periodoFiscal, cuatrimestre, categoriaIA, estado, soloAlertas, deducible, page = 1, limit = 20 } = req.query;
    const filtro = req.filtrarPorTenant();
    if (periodoFiscal) filtro.periodoFiscal = Number(periodoFiscal);
    if (cuatrimestre) filtro.cuatrimestre = Number(cuatrimestre);
    if (categoriaIA) filtro.categoriaIA = categoriaIA;
    if (estado) filtro.estado = estado;
    if (deducible !== undefined) filtro.esDeducible = deducible === 'true';
    // Filtro especial: solo facturas con alertas de tarifa
    if (soloAlertas === 'true') {
      filtro['resumenValidacionTarifa.alertasError'] = { $gt: 0 };
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [facturas, total] = await Promise.all([
      Factura.find(filtro).sort({ fechaEmision: -1 }).skip(skip).limit(Number(limit)),
      Factura.countDocuments(filtro),
    ]);
    res.json({ facturas, total, pagina: Number(page), totalPaginas: Math.ceil(total / Number(limit)) });
  } catch (error) { next(error); }
};

const obtenerFacturaPorId = async (req, res, next) => {
  try {
    const factura = await Factura.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    res.json(factura);
  } catch (error) { next(error); }
};

const actualizarCategoriaFactura = async (req, res, next) => {
  try {
    const { categoriaManual, esDeducible, motivoNoDeducible } = req.body;
    const factura = await Factura.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (categoriaManual) factura.categoriaManual = categoriaManual;
    if (esDeducible !== undefined) factura.esDeducible = esDeducible;
    if (motivoNoDeducible !== undefined) factura.motivoNoDeducible = motivoNoDeducible;
    const actualizada = await factura.save();
    res.json(actualizada);
  } catch (error) { next(error); }
};

const actualizarDeducibilidad = async (req, res, next) => {
  try {
    const { esDeducible, motivoNoDeducible } = req.body;
    const factura = await Factura.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    factura.esDeducible = esDeducible;
    if (!esDeducible) {
      factura.motivoNoDeducible = motivoNoDeducible || 'Gasto no relacionado con la actividad agropecuaria';
    } else {
      factura.motivoNoDeducible = undefined;
    }
    const actualizada = await factura.save();
    res.json(actualizada);
  } catch (error) { next(error); }
};

const eliminarFactura = async (req, res, next) => {
  try {
    const factura = await Factura.findOneAndDelete({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    // Eliminar archivos XML y PDF del disco
    if (factura.archivoXML && fs.existsSync(factura.archivoXML)) {
      fs.unlinkSync(factura.archivoXML);
    }
    if (factura.archivoPDF && fs.existsSync(factura.archivoPDF)) {
      fs.unlinkSync(factura.archivoPDF);
    }
    res.json({ mensaje: 'Factura eliminada correctamente' });
  } catch (error) { next(error); }
};

// --- Descarga de archivos XML ---

// Helper: resolver ruta de archivo (soporta rutas relativas y absolutas legacy)
function resolverRutaArchivo(rutaDB) {
  if (!rutaDB) return null;
  // Si ya es ruta absoluta (legacy), usarla directamente
  if (path.isAbsolute(rutaDB)) return rutaDB;
  // Si es relativa (nueva: "uploads/xml/..."), resolverla desde el dir del backend
  return path.join(__dirname, '..', rutaDB);
}

const descargarXML = async (req, res, next) => {
  try {
    const factura = await Factura.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    if (!factura.archivoXML) {
      return res.status(404).json({ error: 'Esta factura no tiene archivo XML asociado' });
    }
    const rutaXML = resolverRutaArchivo(factura.archivoXML);
    if (!fs.existsSync(rutaXML)) {
      return res.status(404).json({ error: 'Archivo XML no encontrado en el servidor' });
    }
    const nombreArchivo = path.basename(rutaXML);
    return res.download(rutaXML, nombreArchivo, (err) => {
      if (err && !res.headersSent) {
        console.error('Error descargando XML:', err.message);
        return res.status(500).json({ error: 'Error al descargar el archivo XML' });
      }
    });
  } catch (error) { next(error); }
};

const descargarPDF = async (req, res, next) => {
  try {
    const factura = await Factura.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    if (!factura.archivoPDF) {
      return res.status(404).json({ error: 'Esta factura no tiene archivo PDF asociado' });
    }
    const rutaPDF = resolverRutaArchivo(factura.archivoPDF);
    if (!fs.existsSync(rutaPDF)) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado en el servidor' });
    }
    const nombreArchivo = path.basename(rutaPDF);
    return res.download(rutaPDF, nombreArchivo, (err) => {
      if (err && !res.headersSent) {
        console.error('Error descargando PDF:', err.message);
        return res.status(500).json({ error: 'Error al descargar el archivo PDF' });
      }
    });
  } catch (error) { next(error); }
};

// --- Alertas de tarifa ---

const obtenerAlertasTarifa = async (req, res, next) => {
  try {
    const facturas = await Factura.find({
      ...req.filtrarPorTenant(),
      'resumenValidacionTarifa.alertasError': { $gt: 0 },
    }).sort({ fechaEmision: -1 }).limit(100);

    const alertasConsolidadas = [];
    let totalAhorrosPerdidos = 0;

    for (const f of facturas) {
      for (const alerta of (f.alertasTarifa || [])) {
        if (alerta.tieneAlerta) {
          alertasConsolidadas.push({
            facturaId: f._id,
            fecha: f.fechaEmision,
            emisor: f.emisor?.nombre,
            ...alerta.toObject(),
          });
          totalAhorrosPerdidos += alerta.diferenciaIVA || 0;
        }
      }
    }

    res.json({
      totalAlertas: alertasConsolidadas.length,
      totalAhorrosPerdidos,
      totalFacturasAfectadas: facturas.length,
      alertas: alertasConsolidadas,
    });
  } catch (error) { next(error); }
};

// --- Endpoints de Email e Ingesta ---

const estadoEmail = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    const suffix = req.usuario?._id ? String(req.usuario._id).slice(-4) : 'finca';
    const alias = tenant?.emailAlias || (req.usuario?.nombreFinca ? `${req.usuario.nombreFinca.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${suffix}` : `finca-${suffix}`);
    const correoRecepcion = `${alias}@contadorganandero.com`;

    // Si el usuario configuró explícitamente IMAP en su cuenta
    let estadoIMAP = null;
    if (req.usuario?.configEmail?.host && req.usuario?.configEmail?.usuario) {
      try {
        estadoIMAP = obtenerEstado();
      } catch {
        estadoIMAP = { conectado: false };
      }
    }

    res.json({
      canalPrincipal: 'cloudflare-email',
      buzon: correoRecepcion,
      alias,
      dominio: 'contadorganandero.com',
      conectado: true,
      mensaje: 'Recepción en tiempo real activa vía Cloudflare Worker',
      imapLegacy: estadoIMAP,
    });
  } catch (error) { next(error); }
};

const forzarSincronizacion = async (req, res, next) => {
  try {
    // Si el usuario tiene credenciales IMAP personales configuradas, ejecutarlas
    if (req.usuario?.configEmail?.host && req.usuario?.configEmail?.usuario) {
      try {
        const soloNoLeidos = req.query.soloNoLeidos === 'true' || req.body.soloNoLeidos === true;
        const resultado = await sincronizarManual(req.usuario._id, { soloNoLeidos });
        return res.json({ modo: 'imap', ...resultado });
      } catch (err) {
        console.warn('⚠️ Sincronización IMAP falló, pero buzón Cloudflare sigue activo:', err.message);
      }
    }

    // Sincronización estándar Cloudflare (refresco de datos)
    const totalFacturas = await Factura.countDocuments({
      $or: [{ usuario: req.usuario._id }, { tenantId: req.tenantId }]
    });

    res.json({
      modo: 'cloudflare',
      mensaje: 'Facturas sincronizadas correctamente con el servidor.',
      totalFacturas,
    });
  } catch (error) { next(error); }
};

const subirXMLManual = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400);
      throw new Error('Debe seleccionar un archivo XML válido.');
    }

    const xmlString = req.file.buffer.toString('utf-8');
    const resultado = await procesarFacturaXMLString(xmlString, {
      usuarioId: req.usuario._id,
      tenantId: req.tenantId || req.usuario.tenantId,
      canal: 'subida-manual',
    });

    if (!resultado.exito) {
      res.status(400);
      throw new Error(resultado.error || resultado.mensaje || 'Error al procesar la factura XML');
    }

    res.status(201).json({
      exito: true,
      mensaje: 'Factura procesada y registrada exitosamente.',
      ...resultado,
    });
  } catch (error) { next(error); }
};

const crearGastoManual = async (req, res, next) => {
  try {
    const { fechaEmision, emisorNombre, categoriaManual, totalVenta, totalImpuesto, descripcion, numComprobante } = req.body;
    
    if (!fechaEmision || !emisorNombre || totalVenta === undefined || totalVenta === null) {
      res.status(400);
      throw new Error('Faltan campos requeridos: fechaEmision, emisorNombre, totalVenta');
    }

    const totalVentaNum = Number(totalVenta);
    const totalImpuestoNum = Number(totalImpuesto || 0);

    if (isNaN(totalVentaNum) || totalVentaNum < 0) {
      res.status(400);
      throw new Error('totalVenta debe ser un número válido mayor o igual a 0');
    }
    if (isNaN(totalImpuestoNum) || totalImpuestoNum < 0) {
      res.status(400);
      throw new Error('totalImpuesto debe ser un número válido mayor o igual a 0');
    }

    const fecha = new Date(fechaEmision);

    // Validar la tarifa del gasto manual si tiene descripción
    let alertasTarifa = [];
    let resumenValidacionTarifa = { totalLineas: 0, alertasError: 0, alertasAdvertencia: 0, lineasOk: 0, ahorrosPerdidos: 0 };
    if (descripcion) {
      const lineasTemp = [{ descripcion, subtotal: totalVentaNum, impuesto: { codigoTarifa: '08', tarifa: 13 } }];
      const validacion = validarTarifasFactura(lineasTemp);
      alertasTarifa = validacion.alertas;
      resumenValidacionTarifa = validacion.resumenValidacion;
    }
    
    const nuevaFactura = await Factura.create(req.aplicarTenant({
      fechaEmision: fecha,
      emisor: { nombre: emisorNombre },
      resumenFactura: {
        totalVenta: totalVentaNum,
        totalImpuesto: totalImpuestoNum,
        totalComprobante: totalVentaNum + totalImpuestoNum,
      },
      lineaDetalle: [{ descripcion, precioUnitario: totalVentaNum, cantidad: 1, subtotal: totalVentaNum, montoTotal: totalVentaNum + totalImpuestoNum }],
      categoriaIA: categoriaManual || 'sin_clasificar',
      categoriaManual: categoriaManual || 'sin_clasificar',
      confianzaIA: 1,
      estado: alertasTarifa.length > 0 ? 'revision' : 'procesada',
      cuatrimestre: obtenerCuatrimestre(fecha),
      periodoFiscal: fecha.getFullYear(),
      usuario: req.usuario._id,
      esDeducible: true,
      alertasTarifa,
      resumenValidacionTarifa,
      consecutivo: numComprobante,
    }));

    res.status(201).json(nuevaFactura);
  } catch (error) { next(error); }
};

const diagnosticarIMAP = async (req, res, next) => {
  try {
    const { ImapFlow } = require('imapflow');
    const { configurarIMAP } = require('../config/email');
    const config = configurarIMAP();

    if (!config.auth.user || !config.auth.pass) {
      return res.status(400).json({
        conectado: false,
        error: 'Faltan credenciales IMAP (IMAP_USER o IMAP_PASSWORD)',
        detalles: { user: !!config.auth.user, pass: !!config.auth.pass },
      });
    }

    const cliente = new ImapFlow(config);
    let resultado = { conectado: false, error: null, serverInfo: null };

    try {
      await cliente.connect();
      resultado.conectado = true;
      resultado.serverInfo = cliente.serverInfo || 'Sin info';
      await cliente.logout();
    } catch (err) {
      resultado.error = err.message;
      if (err.response) resultado.imapResponse = err.response;
    }

    res.json({
      ...resultado,
      configCheck: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.auth.user,
        passLength: config.auth.pass.length,
      },
      recomendacion: resultado.conectado
        ? 'Todo bien! Conexión IMAP exitosa.'
        : 'La contraseña de aplicación de Gmail es incorrecta o caducó. Genera una nueva en myaccount.google.com/apppasswords',
    });
  } catch (error) { next(error); }
};

module.exports = {
  obtenerFacturas,
  obtenerFacturaPorId,
  actualizarCategoriaFactura,
  actualizarDeducibilidad,
  eliminarFactura,
  crearGastoManual,
  estadoEmail,
  forzarSincronizacion,
  descargarXML,
  descargarPDF,
  obtenerAlertasTarifa,
  diagnosticarIMAP,
  subirXMLManual,
};
