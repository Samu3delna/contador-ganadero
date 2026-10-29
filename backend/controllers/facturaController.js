const path = require('path');
const fs = require('fs');
const Factura = require('../models/Factura');
const { obtenerCuatrimestre } = require('../utils/costaRicaTax');
const { sincronizarManual, obtenerEstado } = require('../services/emailService');
const { procesarFacturaXMLString } = require('../services/ingestaFacturaService');
const { validarTarifasFactura } = require('../utils/insumosAgropecuarios');

const UPLOADS_BASE_DIR = path.resolve(process.env.UPLOAD_ROOT || path.join(__dirname, '..', 'uploads'));

const obtenerFacturas = async (req, res, next) => {
  try {
    const { periodoFiscal, cuatrimestre, categoriaIA, estado, soloAlertas, deducible, page = 1, limit = 20 } = req.query;
    const filtro = req.filtrarPorTenant();
    if (periodoFiscal) filtro.periodoFiscal = Number(periodoFiscal);
    if (cuatrimestre) filtro.cuatrimestre = Number(cuatrimestre);
    if (categoriaIA) filtro.categoriaIA = categoriaIA;
    if (estado) filtro.estado = estado;
    if (deducible !== undefined) filtro.esDeducible = deducible === 'true';
    if (soloAlertas === 'true') {
      filtro['resumenValidacionTarifa.alertasError'] = { $gt: 0 };
    }
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * limitNum;
    const [facturas, total] = await Promise.all([
      Factura.find(filtro).sort({ fechaEmision: -1 }).skip(skip).limit(limitNum),
      Factura.countDocuments(filtro),
    ]);
    res.json({ facturas, total, pagina: pageNum, totalPaginas: Math.ceil(total / limitNum) });
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
    if (esDeducible !== undefined) factura.esDeducible = Boolean(esDeducible);
    if (motivoNoDeducible !== undefined) factura.motivoNoDeducible = String(motivoNoDeducible).slice(0, 500);
    const actualizada = await factura.save();
    res.json(actualizada);
  } catch (error) { next(error); }
};

const actualizarDeducibilidad = async (req, res, next) => {
  try {
    const { esDeducible, motivoNoDeducible } = req.body;
    const factura = await Factura.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    factura.esDeducible = Boolean(esDeducible);
    if (!factura.esDeducible) {
      factura.motivoNoDeducible = motivoNoDeducible || 'Gasto no relacionado con la actividad agropecuaria';
    } else {
      factura.motivoNoDeducible = undefined;
    }
    const actualizada = await factura.save();
    res.json(actualizada);
  } catch (error) { next(error); }
};

/**
 * Helper seguro contra Path Traversal (LFI):
 * Resuelve la ruta del archivo y verifica que pertenezca estrictamente al directorio uploads/.
 */
function resolverRutaArchivoSegura(rutaDB) {
  if (!rutaDB || typeof rutaDB !== 'string') return null;
  const portablePath = rutaDB.replace(/[\\/]+/g, path.sep);
  const candidate = path.isAbsolute(portablePath)
    ? path.resolve(portablePath)
    : portablePath === 'uploads' || portablePath.startsWith(`uploads${path.sep}`)
      ? path.resolve(UPLOADS_BASE_DIR, path.relative('uploads', portablePath))
      : path.resolve(__dirname, '..', portablePath);

  const relative = path.relative(UPLOADS_BASE_DIR, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return candidate;
}

const eliminarFactura = async (req, res, next) => {
  try {
    const factura = await Factura.findOneAndDelete({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    const rutaXML = resolverRutaArchivoSegura(factura.archivoXML);
    const rutaPDF = resolverRutaArchivoSegura(factura.archivoPDF);
    if (rutaXML && fs.existsSync(rutaXML)) {
      fs.unlinkSync(rutaXML);
    }
    if (rutaPDF && fs.existsSync(rutaPDF)) {
      fs.unlinkSync(rutaPDF);
    }
    res.json({ mensaje: 'Factura eliminada correctamente' });
  } catch (error) { next(error); }
};

const descargarXML = async (req, res, next) => {
  try {
    const factura = await Factura.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    if (!factura.archivoXML) {
      return res.status(404).json({ error: 'Esta factura no tiene archivo XML asociado' });
    }
    const rutaXML = resolverRutaArchivoSegura(factura.archivoXML);
    if (!rutaXML || !fs.existsSync(rutaXML)) {
      return res.status(404).json({ error: 'Archivo XML no encontrado en el servidor' });
    }
    const nombreArchivo = path.basename(rutaXML).replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(rutaXML, nombreArchivo, (err) => {
      if (err && !res.headersSent) {
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
    const rutaPDF = resolverRutaArchivoSegura(factura.archivoPDF);
    if (!rutaPDF || !fs.existsSync(rutaPDF)) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado en el servidor' });
    }
    const nombreArchivo = path.basename(rutaPDF).replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(rutaPDF, nombreArchivo, (err) => {
      if (err && !res.headersSent) {
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
    if (req.usuario?.configEmail?.host && req.usuario?.configEmail?.usuario) {
      try {
        const soloNoLeidos = req.query.soloNoLeidos === 'true' || req.body.soloNoLeidos === true;
        const resultado = await sincronizarManual(req.usuario._id, { soloNoLeidos });
        return res.json({ modo: 'imap', ...resultado });
      } catch {
        // Fallback silencioso a buzón Cloudflare
      }
    }

    const totalFacturas = await Factura.countDocuments(req.filtrarPorTenant());

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
      tenantId: req.tenant?._id || req.usuario.tenantId,
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
      emisor: { nombre: String(emisorNombre).trim().slice(0, 150) },
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
    if (!req.usuario?.isSuperAdmin) {
      return res.status(403).json({ error: 'Solo el Super Admin puede ejecutar diagnósticos IMAP globales.' });
    }
    const { ImapFlow } = require('imapflow');
    const { configurarIMAP } = require('../config/email');
    const config = configurarIMAP();

    if (!config.auth.user || !config.auth.pass) {
      return res.status(400).json({
        conectado: false,
        error: 'Faltan credenciales IMAP configuradas en el servidor',
      });
    }

    const cliente = new ImapFlow(config);
    const resultado = { conectado: false, error: null };

    try {
      await cliente.connect();
      resultado.conectado = true;
      await cliente.logout();
    } catch {
      resultado.error = 'No se pudo establecer conexión con el servidor IMAP';
    }

    res.json({
      ...resultado,
      configCheck: {
        host: config.host,
        port: config.port,
        secure: config.secure,
      },
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
  resolverRutaArchivoSegura,
};
