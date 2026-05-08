const path = require('path');
const fs = require('fs');
const Factura = require('../models/Factura');
const { obtenerCuatrimestre } = require('../utils/costaRicaTax');
const { sincronizarManual, obtenerEstado } = require('../services/emailService');
const { validarTarifasFactura } = require('../utils/insumosAgropecuarios');

const obtenerFacturas = async (req, res, next) => {
  try {
    const { periodoFiscal, cuatrimestre, categoriaIA, estado, soloAlertas, page = 1, limit = 20 } = req.query;
    const filtro = { usuario: req.usuario._id };
    if (periodoFiscal) filtro.periodoFiscal = Number(periodoFiscal);
    if (cuatrimestre) filtro.cuatrimestre = Number(cuatrimestre);
    if (categoriaIA) filtro.categoriaIA = categoriaIA;
    if (estado) filtro.estado = estado;
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
    const factura = await Factura.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    res.json(factura);
  } catch (error) { next(error); }
};

const actualizarCategoriaFactura = async (req, res, next) => {
  try {
    const { categoriaManual, esDeducible } = req.body;
    const factura = await Factura.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (categoriaManual) factura.categoriaManual = categoriaManual;
    if (esDeducible !== undefined) factura.esDeducible = esDeducible;
    const actualizada = await factura.save();
    res.json(actualizada);
  } catch (error) { next(error); }
};

const eliminarFactura = async (req, res, next) => {
  try {
    const factura = await Factura.findOneAndDelete({ _id: req.params.id, usuario: req.usuario._id });
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
    const factura = await Factura.findOne({ _id: req.params.id, usuario: req.usuario._id });
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
    const factura = await Factura.findOne({ _id: req.params.id, usuario: req.usuario._id });
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
      usuario: req.usuario._id,
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

// --- Endpoints de Email ---

const estadoEmail = async (req, res, next) => {
  try {
    const estado = obtenerEstado();
    res.json(estado);
  } catch (error) { next(error); }
};

const forzarSincronizacion = async (req, res, next) => {
  try {
    const resultado = await sincronizarManual(req.usuario._id);
    res.json(resultado);
  } catch (error) { next(error); }
};

const crearGastoManual = async (req, res, next) => {
  try {
    const { fechaEmision, emisorNombre, categoriaManual, totalVenta, totalImpuesto, descripcion } = req.body;
    
    if (!fechaEmision || !emisorNombre || !totalVenta) {
      res.status(400);
      throw new Error('Faltan campos requeridos');
    }

    const fecha = new Date(fechaEmision);

    // Validar la tarifa del gasto manual si tiene descripción
    let alertasTarifa = [];
    let resumenValidacionTarifa = { totalLineas: 0, alertasError: 0, alertasAdvertencia: 0, lineasOk: 0, ahorrosPerdidos: 0 };
    if (descripcion) {
      const lineasTemp = [{ descripcion, subtotal: Number(totalVenta), impuesto: { codigoTarifa: '08', tarifa: 13 } }];
      const validacion = validarTarifasFactura(lineasTemp);
      alertasTarifa = validacion.alertas;
      resumenValidacionTarifa = validacion.resumenValidacion;
    }
    
    const nuevaFactura = await Factura.create({
      fechaEmision: fecha,
      emisor: { nombre: emisorNombre },
      resumenFactura: {
        totalVenta: Number(totalVenta),
        totalImpuesto: Number(totalImpuesto || 0),
        totalComprobante: Number(totalVenta) + Number(totalImpuesto || 0),
      },
      lineaDetalle: [{ descripcion, precioUnitario: Number(totalVenta), cantidad: 1, subtotal: Number(totalVenta), montoTotal: Number(totalVenta) + Number(totalImpuesto || 0) }],
      categoriaIA: categoriaManual || 'otros',
      categoriaManual: categoriaManual || 'otros',
      confianzaIA: 1,
      estado: alertasTarifa.length > 0 ? 'revision' : 'procesada',
      cuatrimestre: obtenerCuatrimestre(fecha),
      periodoFiscal: fecha.getFullYear(),
      usuario: req.usuario._id,
      esDeducible: true,
      alertasTarifa,
      resumenValidacionTarifa,
    });

    res.status(201).json(nuevaFactura);
  } catch (error) { next(error); }
};

module.exports = {
  obtenerFacturas,
  obtenerFacturaPorId,
  actualizarCategoriaFactura,
  eliminarFactura,
  crearGastoManual,
  estadoEmail,
  forzarSincronizacion,
  descargarXML,
  descargarPDF,
  obtenerAlertasTarifa,
};
