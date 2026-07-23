/**
 * Generador de XML v4.4 para Hacienda CR.
 * Estructura conforme al esquema oficial de comprobantes electronicos.
 * Soporta: FE, TE, NC, ND, FEC, REP.
 *
 * Produces XML string WITHOUT signature. El signer.js inyecta la firma
 * XAdES-EPES envolviendo este XML.
 */

const TIPO_DOC_CODIGO = {
  FE: '01',
  TE: '02',
  NC: '03',
  ND: '04',
  FEC: '05',
  REP: '06',
};

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
  //Impuesto (IVA)
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
 * Construye el XML v4.4 (sin firmar).
 * @returns {string} XML string
 */
function buildXml(factura) {
  if (!factura) throw new Error('factura requerida');
  if (!factura.claveNumerica || factura.claveNumerica.length !== 50) {
    throw new Error('claveNumerica invalida (debe ser 50 digitos)');
  }
  if (!factura.consecutivo || factura.consecutivo.length !== 20) {
    throw new Error('consecutivo invalido (debe ser 20 digitos)');
  }

  const tipoDoc = factura.tipoDocumento || 'FE';
  const fechaStr = fmtFecha(factura.fechaEmision || new Date());
  const ambienteCod = factura.ambiente === 'produccion' ? '1' : '2';

  const lineasXml = (factura.lineaDetalle || [])
    .map((l, i) => buildLinea(l, i))
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica
  xmlns="https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronica"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
  xsi:schemaLocation="https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronica https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronica_V4.4.xsd">
  <Clave>${factura.claveNumerica}</Clave>
  <CodigoActividad>${escapeXml(factura.codigoActividadEmisor || '000000')}</CodigoActividad>
  <NumeroConsecutivo>${factura.consecutivo}</NumeroConsecutivo>
  <FechaEmision>${fechaStr}</FechaEmision>
  <IndicadorAutomatico>${escapeXml(factura.indicadorAutomatico || '0')}</IndicadorAutomatico>
  <Emisor>
    <Nombre>${escapeXml(factura.emisor.nombre)}</Nombre>
    <Identificacion>
      <Tipo>${tipoIdentificacionXml(factura.emisor.cedula?.tipo || '01')}</Tipo>
      <Numero>${escapeXml(factura.emisor.cedula?.numero)}</Numero>
    </Identificacion>
    <NombreComercial>${escapeXml(factura.emisor.nombreComercial || factura.emisor.nombre)}</NombreComercial>${factura.emisor.provincia ? `
    <Ubicacion>
      <Provincia>${escapeXml(factura.emisor.provincia)}</Provincia>
      <Canton>${escapeXml(factura.emisor.canton || '')}</Canton>
      <Distrito>${escapeXml(factura.emisor.distrito || '')}</Distrito>
      <Barrio>${escapeXml(factura.emisor.barrio || '01')}</Barrio>
      <OtrasSenas>${escapeXml(factura.emisor.ubicacion || factura.emisor.otrasSenas || '')}</OtrasSenas>
    </Ubicacion>` : ''}
    <Telefono>
      <CodigoPais>506</CodigoPais>
      <NumTelefono>${escapeXml((factura.emisor.telefono || '').replace(/\D/g, '').slice(0, 8).padStart(8, '0'))}</NumTelefono>
    </Telefono>
    <CorreoElectronico>${escapeXml(factura.emisor.correo || 'noreply@hacienda.go.cr')}</CorreoElectronico>
  </Emisor>${factura.receptor && tipoDoc !== 'TE' ? `
  <Receptor>
    <Nombre>${escapeXml(factura.receptor.nombre)}</Nombre>${factura.receptor.cedula?.numero ? `
    <Identificacion>
      <Tipo>${tipoIdentificacionXml(factura.receptor.cedula?.tipo || '02')}</Tipo>
      <Numero>${escapeXml(factura.receptor.cedula?.numero)}</Numero>
    </Identificacion>` : ''}${factura.receptor.provincia ? `
    <Ubicacion>
      <Provincia>${escapeXml(factura.receptor.provincia)}</Provincia>
      <Canton>${escapeXml(factura.receptor.canton || '')}</Canton>
      <Distrito>${escapeXml(factura.receptor.distrito || '')}</Distrito>
      <Barrio>${escapeXml(factura.receptor.barrio || '01')}</Barrio>
      <OtrasSenas>${escapeXml(factura.receptor.ubicacion || factura.receptor.otrasSenas || '')}</OtrasSenas>
    </Ubicacion>` : ''}${factura.receptor.telefono ? `
    <Telefono>
      <CodigoPais>506</CodigoPais>
      <NumTelefono>${escapeXml(String(factura.receptor.telefono).replace(/\D/g, '').slice(0, 8).padStart(8, '0'))}</NumTelefono>
    </Telefono>` : ''}${factura.receptor.correo ? `
    <CorreoElectronico>${escapeXml(factura.receptor.correo)}</CorreoElectronico>` : ''}
  </Receptor>` : ''}
  <CondicionVenta>${factura.condicionVenta || '01'}</CondicionVenta>
  <PlazoCredito>${escapeXml(factura.plazoCredito || '0')}</PlazoCredito>
  <MedioPago>${(factura.medioPago || ['01']).map((m) => escapeXml(m)).slice(0, 4).join('</MedioPago><MedioPago>')}</MedioPago>
  ${buildInfoReferencia(factura.documentoReferencia)}
  <DetalleServicio>
${lineasXml}
  </DetalleServicio>
  ${buildResumen(factura.resumenFactura)}
  <Normativa>
    <NumeroResolucion>DGT-R-48-2016</NumeroResolucion>
    <FechaResolucion>07-10-2016</FechaResolucion>
  </Normativa>
  <Otros>
    <OtroTexto>${escapeXml(factura.referencia || '')}</OtroTexto>
    <OtroContenido>${ambienteCod}</OtroContenido>
  </Otros>
</FacturaElectronica>`;

  return xml;
}

module.exports = {
  buildXml,
  TIPO_DOC_CODIGO,
  fmtFecha,
  escapeXml,
};
