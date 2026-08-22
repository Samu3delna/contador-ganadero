/**
 * Generador de XML v4.4 para Hacienda CR.
 * Estructura conforme al esquema oficial de comprobantes electronicos.
 * Soporta: FE, TE, NC, ND, FEC, REP.
 *
 * ProducE XML string WITHOUT signature. El signer.js inyecta la firma
 * XAdES-EPES envolviendo este XML.
 *
 * Cada tipo de documento tiene su propio nodo raiz y namespace (v4.4):
 *   FE  -> <FacturaElectronica>       facturaElectronica
 *   TE  -> <TiqueteElectronico>       tiqueteElectronico
 *   NC  -> <NotaCreditoElectronica>   notaCreditoElectronica
 *   ND  -> <NotaDebitoElectronica>    notaDebitoElectronica
 *   FEC -> <FacturaElectronicaCompra> facturaElectronicaCompra
 *   REP -> <MensajeReceptor>          mensajeReceptor
 */

// Metadatos por tipo de documento ########################################
const TIPO_DOC = {
  FE: {
    codigo: '01',
    raiz: 'FacturaElectronica',
    namespace: 'https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronica',
    xsd: 'facturaElectronica_V4.4.xsd',
    requiereReceptor: false, // opcional (pero habitual)
    requiereReferencia: false,
  },
  TE: {
    codigo: '02',
    raiz: 'TiqueteElectronico',
    namespace: 'https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/tiqueteElectronico',
    xsd: 'tiqueteElectronico_V4.4.xsd',
    requiereReceptor: false, // TE no lleva receptor
    requiereReferencia: false,
  },
  NC: {
    codigo: '03',
    raiz: 'NotaCreditoElectronica',
    namespace: 'https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/notaCreditoElectronica',
    xsd: 'notaCreditoElectronica_V4.4.xsd',
    requiereReceptor: true,
    requiereReferencia: true, // InformacionReferencia obligatoria
    impuestoExtra: 'acreditar',
  },
  ND: {
    codigo: '04',
    raiz: 'NotaDebitoElectronica',
    namespace: 'https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/notaDebitoElectronica',
    xsd: 'notaDebitoElectronica_V4.4.xsd',
    requiereReceptor: true,
    requiereReferencia: true,
    impuestoExtra: 'debitar',
  },
  FEC: {
    codigo: '05',
    raiz: 'FacturaElectronicaCompra',
    namespace: 'https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronicaCompra',
    xsd: 'facturaElectronicaCompra_V4.4.xsd',
    requiereReceptor: false, // el emisor asume rol de comprador; el vendedor va en referencia/extra
    requiereReferencia: false, // opcional: documento fisico del vendedor
  },
  REP: {
    codigo: '06',
    raiz: 'MensajeReceptor',
    namespace: 'https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/mensajeReceptor',
    xsd: 'mensajeReceptor_V4.4.xsd',
    requiereReceptor: false, // estructura completamente distinta (no hereda de FE)
    requiereReferencia: true,
  },
};

// Mapa de compatibilidad (código del tipo de documento)
const TIPO_DOC_CODIGO = Object.fromEntries(
  Object.entries(TIPO_DOC).map(([k, v]) => [k, v.codigo])
);

// Entidades XML ########################################################
const AMP = String.fromCharCode(38) + 'amp;';      // &
const LT = String.fromCharCode(38) + 'lt;';        // <
const GT = String.fromCharCode(38) + 'gt;';        // >
const QUOT = String.fromCharCode(38) + 'quot;';     // "
const APOS = String.fromCharCode(38) + 'apos;';     // '
const XML_ENTITIES = {
  '&': AMP,
  '<': LT,
  '>': GT,
  '"': QUOT,
  "'": APOS,
};

function escapeXml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (ch) => XML_ENTITIES[ch] || ch);
}

function fmtFecha(d) {
  if (!d) d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}-06:00`;
}

/**
 * Mapea tipoCedula de Hacienda:
 *  01 Fisica, 02 Juridica, 03 DIMEX, 04 NITE
 */
function tipoIdentificacionXml(tipo) {
  return ['01', '02', '03', '04'].includes(tipo) ? tipo : '01';
}

/**
 * Padding de cedula a 12 digitos (usado en el MensajeReceptor).
 */
function padCedula(numero) {
  const limpio = String(numero || '').replace(/[^0-9]/g, '');
  return limpio.padStart(12, '0').slice(-12);
}

function buildLinea(linea, idx) {
  const unidad = linea.unidadMedida || 'kg';
  const cabys = String(linea.codigo || '').padStart(13, '0').slice(-13);
  const subTot = Number(linea.subtotal).toFixed(2);
  const montoTotal = Number(linea.montoTotal).toFixed(2);
  const imp = linea.impuesto || {};

  let xml = `      <LineaDetalle>
        <NumeroLinea>${idx + 1}</NumeroLinea>
        <Codigo>
          <Tipo>04</Tipo>
          <Codigo>${escapeXml(cabys)}</Codigo>
        </Codigo>
        <Cantidad>${Number(linea.cantidad).toFixed(3)}</Cantidad>
        <UnidadMedida>${escapeXml(unidad)}</UnidadMedida>
        <UnidadMedidaComercial>${escapeXml(linea.unidadMedidaComercial || unidad)}</UnidadMedidaComercial>
        <Detalle>${escapeXml(linea.descripcion)}</Detalle>
        <PrecioUnitario>${Number(linea.precioUnitario).toFixed(2)}</PrecioUnitario>
        <MontoTotal>${montoTotal}</MontoTotal>`;
  if (linea.descuento?.monto) {
    xml += `
        <Descuento>
          <MontoDescuento>${Number(linea.descuento.monto).toFixed(2)}</MontoDescuento>
          <NaturalezaDescuento>${escapeXml(linea.descuento.naturalezaDescuento || 'Descuento comercial')}</NaturalezaDescuento>
        </Descuento>`;
  }
  xml += `
        <SubTotal>${subTot}</SubTotal>`;
  // Impuesto (IVA)
  if (imp.tarifa != null && imp.tarifa > 0) {
    xml += `
        <Impuesto>
          <Codigo>${escapeXml(imp.codigo || '01')}</Codigo>
          <CodigoTarifa>${escapeXml(imp.codigoTarifa || '02')}</CodigoTarifa>
          <Tarifa>${Number(imp.tarifa).toFixed(2)}</Tarifa>
          <Monto>${Number(imp.monto || 0).toFixed(2)}</Monto>`;
    if (imp.exoneracion?.montoExoneracion) {
      xml += `
          <Exoneracion>
            <TipoDocumento>${escapeXml(imp.exoneracion.tipoDocumento || '01')}</TipoDocumento>
            <NumeroDocumento>${escapeXml(imp.exoneracion.numeroDocumento || '')}</NumeroDocumento>
            <NombreInstitucion>${escapeXml(imp.exoneracion.nombreInstitucion || '')}</NombreInstitucion>
            <FechaEmision>${escapeXml(imp.exoneracion.fechaEmision || fmtFecha(new Date()))}</FechaEmision>
            <MontoExoneracion>${Number(imp.exoneracion.montoExoneracion).toFixed(2)}</MontoExoneracion>
            <PorcentajeExoneracion>${Number(imp.exoneracion.porcentajeExoneracion).toFixed(2)}</PorcentajeExoneracion>
          </Exoneracion>`;
    }
    xml += `
        </Impuesto>`;
  }
  xml += `
        <ImpuestoNeto>${Number(linea.impuestoNeto || 0).toFixed(2)}</ImpuestoNeto>
        <MontoTotalLinea>${montoTotal}</MontoTotalLinea>
      </LineaDetalle>`;
  return xml;
}

function buildResumen(resumen) {
  const r = resumen || {};
  return `    <ResumenFactura>
      <CodigoTipoMoneda>
        <CodigoMoneda>CRC</CodigoMoneda>
        <TipoCambio>1.00000</TipoCambio>
      </CodigoTipoMoneda>
      <TotalServGravados>${Number(r.totalServGravados || 0).toFixed(2)}</TotalServGravados>
      <TotalServExentos>${Number(r.totalServExentos || 0).toFixed(2)}</TotalServExentos>
      <TotalMercanciasGravadas>${Number(r.totalMercanciasGravadas || 0).toFixed(2)}</TotalMercanciasGravadas>
      <TotalMercanciasExentas>${Number(r.totalMercanciasExentas || 0).toFixed(2)}</TotalMercanciasExentas>
      <TotalGravado>${Number(r.totalGravado || 0).toFixed(2)}</TotalGravado>
      <TotalExento>${Number(r.totalExento || 0).toFixed(2)}</TotalExento>
      <TotalVenta>${Number(r.totalVenta || 0).toFixed(2)}</TotalVenta>
      <TotalDescuentos>${Number(r.totalDescuentos || 0).toFixed(2)}</TotalDescuentos>
      <TotalVentaNeta>${Number(r.totalVentaNeta || 0).toFixed(2)}</TotalVentaNeta>
      <TotalImpuesto>${Number(r.totalImpuesto || 0).toFixed(2)}</TotalImpuesto>
      <TotalComprobante>${Number(r.totalComprobante || 0).toFixed(2)}</TotalComprobante>
    </ResumenFactura>`;
}

function buildInfoReferencia(ref) {
  if (!ref || !ref.numeroReferencia) return '';
  return `    <InformacionReferencia>
      <TipoDoc>${escapeXml(ref.tipoDocReferencia || '01')}</TipoDoc>
      <Numero>${escapeXml(ref.numeroReferencia)}</Numero>
      <FechaEmision>${escapeXml(ref.fechaEmisionReferencia || fmtFecha(new Date()))}</FechaEmision>
      <Codigo>${escapeXml(ref.codigoReferencia || '01')}</Codigo>
      <Razon>${escapeXml(ref.razonReferencia || 'Referencia')}</Razon>
    </InformacionReferencia>`;
}

/**
 * Nodo <Emisor> compartido por FE/TE/NC/ND/FEC.
 */
function buildEmisor(factura) {
  const e = factura.emisor || {};
  const ubicacion = e.provincia
    ? `
    <Ubicacion>
      <Provincia>${escapeXml(e.provincia)}</Provincia>
      <Canton>${escapeXml(e.canton || '')}</Canton>
      <Distrito>${escapeXml(e.distrito || '')}</Distrito>
      <Barrio>${escapeXml(e.barrio || '01')}</Barrio>
      <OtrasSenas>${escapeXml(e.ubicacion || e.otrasSenas || '')}</OtrasSenas>
    </Ubicacion>`
    : '';
  return `  <Emisor>
    <Nombre>${escapeXml(e.nombre)}</Nombre>
    <Identificacion>
      <Tipo>${tipoIdentificacionXml(e.cedula?.tipo || '01')}</Tipo>
      <Numero>${escapeXml(e.cedula?.numero)}</Numero>
    </Identificacion>
    <NombreComercial>${escapeXml(e.nombreComercial || e.nombre)}</NombreComercial>${ubicacion}
    <Telefono>
      <CodigoPais>506</CodigoPais>
      <NumTelefono>${escapeXml((e.telefono || '').replace(/\D/g, '').slice(0, 8).padStart(8, '0'))}</NumTelefono>
    </Telefono>
    <CorreoElectronico>${escapeXml(e.correo || 'noreply@hacienda.go.cr')}</CorreoElectronico>
  </Emisor>`;
}

/**
 * Nodo <Receptor> compartido por FE/NC/ND (no TE, no FEC, no REP).
 */
function buildReceptor(factura) {
  const r = factura.receptor;
  if (!r || !r.nombre) return '';
  const identificacion = r.cedula?.numero
    ? `
    <Identificacion>
      <Tipo>${tipoIdentificacionXml(r.cedula?.tipo || '02')}</Tipo>
      <Numero>${escapeXml(r.cedula?.numero)}</Numero>
    </Identificacion>`
    : '';
  const ubicacion = r.provincia
    ? `
    <Ubicacion>
      <Provincia>${escapeXml(r.provincia)}</Provincia>
      <Canton>${escapeXml(r.canton || '')}</Canton>
      <Distrito>${escapeXml(r.distrito || '')}</Distrito>
      <Barrio>${escapeXml(r.barrio || '01')}</Barrio>
      <OtrasSenas>${escapeXml(r.ubicacion || r.otrasSenas || '')}</OtrasSenas>
    </Ubicacion>`
    : '';
  const telefono = r.telefono
    ? `
    <Telefono>
      <CodigoPais>506</CodigoPais>
      <NumTelefono>${escapeXml(String(r.telefono).replace(/\D/g, '').slice(0, 8).padStart(8, '0'))}</NumTelefono>
    </Telefono>`
    : '';
  const correo = r.correo
    ? `
    <CorreoElectronico>${escapeXml(r.correo)}</CorreoElectronico>`
    : '';
  return `  <Receptor>
    <Nombre>${escapeXml(r.nombre)}</Nombre>${identificacion}${ubicacion}${telefono}${correo}
  </Receptor>`;
}

/**
 * Arma el nodo raiz con namespace y schemaLocation correctos por tipo.
 */
function buildAperturaRaiz(meta) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<${meta.raiz}
  xmlns="${meta.namespace}"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
  xsi:schemaLocation="${meta.namespace} https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/${meta.xsd}">`;
}

/**
 * Construye comprobantes que heredan la estructura de FE
 * (FE, TE, NC, ND, FEC).
 */
function buildComprobante(factura, meta) {
  const fechaStr = fmtFecha(factura.fechaEmision || new Date());
  const ambienteCod = factura.ambiente === 'produccion' ? '1' : '2';

  const lineasXml = (factura.lineaDetalle || [])
    .map((l, i) => buildLinea(l, i))
    .join('\n');

  const tieneReceptor = !['TE', 'FEC'].includes(factura.tipoDocumento);
  const receptorXml = tieneReceptor ? `${buildReceptor(factura)}\n` : '';
  const referenciaXml = meta.requiereReferencia || factura.documentoReferencia
    ? `${buildInfoReferencia(factura.documentoReferencia)}\n`
    : '';

  // NC -> MontoTotalImpuestoAcreditar, ND -> MontoTotalImpuestoDebitar
  let impuestoExtra = '';
  if (meta.impuestoExtra === 'acreditar') {
    impuestoExtra = `  <MontoTotalImpuestoAcreditar>${Number(factura.resumenFactura?.totalImpuesto || 0).toFixed(2)}</MontoTotalImpuestoAcreditar>\n`;
  } else if (meta.impuestoExtra === 'debitar') {
    impuestoExtra = `  <MontoTotalImpuestoDebitar>${Number(factura.resumenFactura?.totalImpuesto || 0).toFixed(2)}</MontoTotalImpuestoDebitar>\n`;
  }

  return `${buildAperturaRaiz(meta)}
  <Clave>${factura.claveNumerica}</Clave>
  <CodigoActividad>${escapeXml(factura.codigoActividadEmisor || '000000')}</CodigoActividad>
  <NumeroConsecutivo>${factura.consecutivo}</NumeroConsecutivo>
  <FechaEmision>${fechaStr}</FechaEmision>
  <IndicadorAutomatico>${escapeXml(factura.indicadorAutomatico || '0')}</IndicadorAutomatico>
${buildEmisor(factura)}
${receptorXml}  <CondicionVenta>${factura.condicionVenta || '01'}</CondicionVenta>
  <PlazoCredito>${escapeXml(factura.plazoCredito || '0')}</PlazoCredito>
  <MedioPago>${(factura.medioPago || ['01']).map((m) => escapeXml(m)).slice(0, 4).join('</MedioPago><MedioPago>')}</MedioPago>
${referenciaXml}  <DetalleServicio>
${lineasXml}
  </DetalleServicio>
  ${buildResumen(factura.resumenFactura)}
${impuestoExtra}  <Normativa>
    <NumeroResolucion>DGT-R-48-2016</NumeroResolucion>
    <FechaResolucion>07-10-2016</FechaResolucion>
  </Normativa>
  <Otros>
    <OtroTexto>${escapeXml(factura.referencia || '')}</OtroTexto>
    <OtroContenido>${ambienteCod}</OtroContenido>
  </Otros>
</${meta.raiz}>`;
}

/**
 * Construye el MensajeReceptor (REP / codigo 06).
 *
 * Estructura v4.4 distinta a la de los comprobantes: no lleva LineaDetalle
 * ni Receptor; en su lugar referencia la FE original (Clave + datos del
 * emisor) y un DetalleMensaje con el monto del abono.
 *
 * La app lo usa para registrar PAGOS/ABONOS de facturas a credito ya
 * aceptadas (ver controllers/repController.js).
 *
 * ⚠️ Estructura a validar contra mensajeReceptor_V4.4.xsd en sandbox.
 */
function buildMensajeReceptor(factura, meta) {
  const ref = factura.documentoReferencia || {};
  // El <Clave> del REP es la clave de la FE ORIGINAL referenciada.
  const claveOriginal = ref.numeroReferencia || factura.claveNumerica;
  const cedulaEmisor = padCedula(factura.emisor?.cedula?.numero);
  const fechaDoc = ref.fechaEmisionReferencia || factura.fechaEmision || new Date();
  // 1 = aceptación total, 2 = aceptación parcial, 3 = rechazo.
  // Para "mensaje de pago" (caso de uso de la app) se usa 1.
  const mensaje = factura.mensajeReceptor || '1';
  const montoTotalImpuesto = Number(factura.resumenFactura?.totalImpuesto || 0).toFixed(2);
  const totalFactura = Number(factura.resumenFactura?.totalComprobante || 0).toFixed(2);

  return `${buildAperturaRaiz(meta)}
  <Clave>${claveOriginal}</Clave>
  <NumeroCedulaEmisor>${cedulaEmisor}</NumeroCedulaEmisor>
  <FechaEmisionDoc>${fmtFecha(fechaDoc)}</FechaEmisionDoc>
  <Mensaje>${escapeXml(mensaje)}</Mensaje>
  <DetalleMensaje>
    <MontoTotalImpuesto>${montoTotalImpuesto}</MontoTotalImpuesto>
    <TotalFactura>${totalFactura}</TotalFactura>
  </DetalleMensaje>
  <CodigoActividad>${escapeXml(factura.codigoActividadEmisor || '000000')}</CodigoActividad>
  <CondicionImpuesto>01</CondicionImpuesto>
  <CondicionVenta>${factura.condicionVenta || '02'}</CondicionVenta>
</${meta.raiz}>`;
}

/**
 * Construye el XML v4.4 (sin firmar) despachando al builder correcto
 * segun factura.tipoDocumento.
 * @returns {string} XML string
 */
function buildXml(factura) {
  if (!factura) throw new Error('factura requerida');

  const tipoDoc = (factura.tipoDocumento || 'FE').toUpperCase();
  const meta = TIPO_DOC[tipoDoc];
  if (!meta) throw new Error(`Tipo de documento no soportado: ${factura.tipoDocumento}`);

  if (meta.raiz === 'MensajeReceptor') {
    return buildMensajeReceptor(factura, meta);
  }

  // Los comprobantes (FE/TE/NC/ND/FEC) requieren clave de 50 y consecutivo de 20
  if (!factura.claveNumerica || factura.claveNumerica.length !== 50) {
    throw new Error('claveNumerica invalida (debe ser 50 digitos)');
  }
  if (!factura.consecutivo || factura.consecutivo.length !== 20) {
    throw new Error('consecutivo invalido (debe ser 20 digitos)');
  }
  if (!factura.emisor?.cedula?.numero) {
    throw new Error('emisor.cedula.numero es obligatorio');
  }

  return buildComprobante(factura, meta);
}

module.exports = {
  buildXml,
  TIPO_DOC,
  TIPO_DOC_CODIGO,
  fmtFecha,
  escapeXml,
};
