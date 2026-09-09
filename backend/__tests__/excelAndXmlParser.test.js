/**
 * Tests unitarios para xmlParserService y declaracionService (Excel y CSV).
 * Verifica que los números de factura (50 dígitos de clave y 20 dígitos de consecutivo)
 * nunca se alteren ni sufran truncamiento ni notación científica.
 */

const { parsearFacturaXML } = require('../services/xmlParserService');
const { generarExcel, generarCSV } = require('../services/declaracionService');

describe('xmlParserService - Integridad de números de factura', () => {
  const claveReal = '50607052600310147633904700001010000148151199999999';
  const consecutivoReal = '04700001010000148151';
  const cedulaEmisorReal = '03101476339';
  const cedulaReceptorReal = '0119600049';

  const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica">
  <Clave>${claveReal}</Clave>
  <NumeroConsecutivo>${consecutivoReal}</NumeroConsecutivo>
  <FechaEmision>2026-05-07T10:30:00-06:00</FechaEmision>
  <Emisor>
    <Nombre>Veterinaria El Campo</Nombre>
    <Identificacion>
      <Tipo>02</Tipo>
      <Numero>${cedulaEmisorReal}</Numero>
    </Identificacion>
  </Emisor>
  <Receptor>
    <Nombre>Ganadero Modelo</Nombre>
    <Identificacion>
      <Tipo>01</Tipo>
      <Numero>${cedulaReceptorReal}</Numero>
    </Identificacion>
  </Receptor>
  <DetalleServicio>
    <LineaDetalle>
      <NumeroLinea>1</NumeroLinea>
      <Detalle>Vacuna IBR Ganado</Detalle>
      <Cantidad>5</Cantidad>
      <PrecioUnitario>10000</PrecioUnitario>
      <SubTotal>50000</SubTotal>
      <Impuesto>
        <Codigo>01</Codigo>
        <CodigoTarifa>02</CodigoTarifa>
        <Tarifa>1</Tarifa>
        <Monto>500</Monto>
      </Impuesto>
      <MontoTotalLinea>50500</MontoTotalLinea>
    </LineaDetalle>
  </DetalleServicio>
  <ResumenFactura>
    <TotalVenta>50000</TotalVenta>
    <TotalImpuesto>500</TotalImpuesto>
    <TotalComprobante>50500</TotalComprobante>
  </ResumenFactura>
</FacturaElectronica>`;

  test('mantiene la Clave de 50 dígitos exactamente como string sin notación científica', () => {
    const resultado = parsearFacturaXML(sampleXml);
    expect(resultado.claveNumerica).toBe(claveReal);
    expect(resultado.claveNumerica).toHaveLength(50);
    expect(resultado.claveNumerica).not.toContain('e+');
  });

  test('mantiene el Consecutivo de 20 dígitos intacto con todos sus ceros', () => {
    const resultado = parsearFacturaXML(sampleXml);
    expect(resultado.consecutivo).toBe(consecutivoReal);
    expect(resultado.consecutivo).toHaveLength(20);
    expect(resultado.consecutivo.startsWith('047')).toBe(true);
  });

  test('preserva los ceros iniciales de las cédulas', () => {
    const resultado = parsearFacturaXML(sampleXml);
    expect(resultado.emisor.cedula.numero).toBe(cedulaEmisorReal);
    expect(resultado.receptor.cedula.numero).toBe(cedulaReceptorReal);
  });

  test('detecta correctamente el tipo de documento según esquema de Hacienda', () => {
    const resultado = parsearFacturaXML(sampleXml);
    expect(resultado.tipoDocumento).toBe('Factura Electrónica');

    // Probar Tiquete Electrónico (04)
    const xmlTiquete = sampleXml.replace('<NumeroConsecutivo>04700001010000148151</NumeroConsecutivo>', '<NumeroConsecutivo>00100001040000000123</NumeroConsecutivo>');
    expect(parsearFacturaXML(xmlTiquete).tipoDocumento).toBe('Tiquete Electrónico');

    // Probar Nota de Crédito (03)
    const xmlNC = sampleXml.replace('<NumeroConsecutivo>04700001010000148151</NumeroConsecutivo>', '<NumeroConsecutivo>00100001030000000456</NumeroConsecutivo>');
    expect(parsearFacturaXML(xmlNC).tipoDocumento).toBe('Nota de Crédito');
  });
});

describe('declaracionService - Generación de Excel y CSV seguro', () => {
  const datosMock = [{
    tipo: 'GASTO',
    fecha: '2026-05-07',
    proveedor: 'Veterinaria El Campo',
    cedulaProveedor: '03101476339',
    descripcion: 'Vacuna IBR',
    categoria: 'veterinaria',
    subtotal: 50000,
    iva: 500,
    total: 50500,
    consecutivo: '04700001010000148151',
    claveNumerica: '50607052600310147633904700001010000148151199999999',
    numComprobante: '04700001010000148151',
    esDeducible: 'Sí',
    motivoNoDeducible: '',
    tasaIVA: 1,
  }];

  test('generarExcel produce un libro multihuela con celdas de texto estricto para Consecutivo y Clave', async () => {
    const wb = await generarExcel(datosMock, {
      anio: 2026,
      cuatrimestre: 1,
      usuario: { nombreFinca: 'Finca La Pradera', cedula: { numero: '0119600049' } },
    });
    const buffer = await wb.xlsx.writeBuffer();
    expect(buffer.length).toBeGreaterThan(1000);

    // Verificar que tiene 2 hojas (Resumen y Detalle)
    expect(wb.worksheets.length).toBe(2);
    expect(wb.worksheets[0].name).toBe('Resumen Contable');
    expect(wb.worksheets[1].name).toBe('Detalle de Comprobantes');

    // Verificar hoja de Detalle
    const wsDetalle = wb.getWorksheet('Detalle de Comprobantes');
    const dataRow = wsDetalle.getRow(2);

    // Verificar valor y formato de celda Consecutivo
    const cellConsecutivo = dataRow.getCell(10);
    expect(cellConsecutivo.value).toBe('04700001010000148151');
    expect(cellConsecutivo.numFmt).toBe('@');

    // Verificar valor y formato de celda Clave (50 dígitos)
    const cellClave = dataRow.getCell(11);
    expect(cellClave.value).toBe('50607052600310147633904700001010000148151199999999');
    expect(cellClave.numFmt).toBe('@');

    // Verificar Cédula con cero inicial
    const cellCedula = dataRow.getCell(4);
    expect(cellCedula.value).toBe('03101476339');
    expect(cellCedula.numFmt).toBe('@');

    // Verificar hoja de Resumen
    const wsResumen = wb.getWorksheet('Resumen Contable');
    expect(wsResumen.getCell('B2').value).toContain('SISTEMA CONTABLE GANADERO');
    expect(wsResumen.getCell('C4').value).toBe('Finca La Pradera');
  });

  test('generarCSV formatea identificadores con ="VALOR" para evitar truncamiento en Excel', () => {
    const csv = generarCSV(datosMock);
    expect(csv).toContain('="04700001010000148151"');
    expect(csv).toContain('="50607052600310147633904700001010000148151199999999"');
    expect(csv).toContain('="03101476339"');
  });

  test('reporteExcel de D-150 genera las dos hojas oficiales correctamente', async () => {
    const { reporteExcel } = require('../controllers/d150Controller');
    const d150Service = require('../services/d150Service');

    jest.spyOn(d150Service, 'generarConciliacion').mockResolvedValueOnce({
      periodo: { mes: 5, anio: 2026 },
      totales: {
        ventasGravadasBase: 1000000,
        ventasIVADebito: 130000,
        ventasExentas: 0,
        comprasGravadasBase: 500000,
        comprasIVACredito: 65000,
        comprasExentas: 0,
      },
      detalleVentas: [{ label: 'Tarifa general 13%', cantidadDocumentos: 2, baseImponible: 1000000, ivaDebitoFiscal: 130000, notasCreditoAplicadas: 0 }],
      detalleCompras: [{ label: 'Compras grabadas al 13%', cantidadDocumentos: 3, baseImponible: 500000, ivaCreditoFiscal: 65000 }],
      prorrata: { porcentajeDeducible: 100, creditoTotal: 65000, creditoDeducible: 65000, creditoNoDeducible: 0 },
      retencionesTarjeta: { total: 0 },
      ivaRetenidoPorTerceros: 0,
      resultadoFinal: { debitoFiscal: 130000, creditoDeducible: 65000, totalRetencionesTarjeta: 0, ivaRetenidoPorTerceros: 0, ivaAPagar: 65000, saldoAFavor: 0 },
      documentos: [{
        tipo: 'VENTA',
        tipoDoc: 'FE',
        fecha: '2026-05-10',
        tercero: 'Carnes del Norte',
        cedula: '03101476339',
        consecutivo: '00100001010000000050',
        claveNumerica: '50607052600310147633900100001010000000050199999999',
        subtotal: 1000000,
        iva: 130000,
        total: 1130000,
        tasaIVA: 13,
        esDeducible: 'Sí',
      }],
    });

    const buffers = [];
    const mockRes = {
      setHeader: jest.fn(),
      write: jest.fn((chunk) => buffers.push(chunk)),
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
    };

    const mockReq = {
      query: { mes: 5, anio: 2026 },
      usuario: { nombreFinca: 'Finca Don Pedro', cedula: { numero: '0119600049' } },
    };

    await reporteExcel(mockReq, mockRes, jest.fn());
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(mockRes.end).toHaveBeenCalled();
  });
});
