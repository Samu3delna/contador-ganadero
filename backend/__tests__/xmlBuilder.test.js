/**
 * Tests unitarios del generador de XML v4.4 (FE, TE, NC, ND, FEC, REP).
 *
 * No requiere MongoDB: son tests puros de strings + parseo XML.
 */

const { XMLParser } = require('fast-xml-parser');
const { buildXml, TIPO_DOC } = require('../services/hacienda/xmlBuilder');
const { generarClave } = require('../services/hacienda/clave50');
const { detectarRaiz } = require('../services/hacienda/signer');

const parser = new XMLParser({ ignoreAttributes: false });

const REFERENCIA = '506010123000123456789001000010100000000001234567890';

function hacerFactura(tipoDocumento, overrides = {}) {
  const { clave, consecutivo } = generarClave({
    fecha: new Date(),
    tipoDocumento,
    cedulaEmisor: '123456789',
    tipoCedula: '01',
    secuencia: 1,
  });
  return {
    tipoDocumento,
    claveNumerica: clave,
    consecutivo,
    fechaEmision: new Date(),
    ambiente: 'local',
    emisor: {
      nombre: 'Finca Test',
      cedula: { tipo: '01', numero: '123456789' },
      telefono: '88888888',
      correo: 'finca@test.cr',
    },
    receptor: {
      nombre: 'Comprador',
      cedula: { tipo: '02', numero: '3101234567' },
    },
    lineaDetalle: [{
      numeroLinea: 1,
      codigo: '0212010100100',
      descripcion: 'Carne bovino',
      cantidad: 10,
      unidadMedida: 'kg',
      precioUnitario: 5000,
      subtotal: 50000,
      impuesto: { codigo: '01', codigoTarifa: '02', tarifa: 1, monto: 500 },
      impuestoNeto: 500,
      montoTotal: 50500,
    }],
    resumenFactura: {
      totalGravado: 50000,
      totalVenta: 50000,
      totalVentaNeta: 50000,
      totalImpuesto: 500,
      totalComprobante: 50500,
    },
    condicionVenta: '01',
    medioPago: ['01'],
    documentoReferencia: {
      tipoDocReferencia: '01',
      numeroReferencia: REFERENCIA,
      fechaEmisionReferencia: new Date(),
      codigoReferencia: '01',
      razonReferencia: 'Anulacion',
    },
    ...overrides,
  };
}

describe('xmlBuilder.buildXml', () => {
  test('cada tipo produce su nodo raiz y namespace correctos', () => {
    const esperado = {
      FE: ['FacturaElectronica', 'facturaElectronica'],
      TE: ['TiqueteElectronico', 'tiqueteElectronico'],
      NC: ['NotaCreditoElectronica', 'notaCreditoElectronica'],
      ND: ['NotaDebitoElectronica', 'notaDebitoElectronica'],
      FEC: ['FacturaElectronicaCompra', 'facturaElectronicaCompra'],
      REP: ['MensajeReceptor', 'mensajeReceptor'],
    };
    for (const [tipo, [raiz, ns]] of Object.entries(esperado)) {
      const xml = buildXml(hacerFactura(tipo));
      expect(detectarRaiz(xml)).toBe(raiz);
      expect(xml).toContain(`xmlns="${TIPO_DOC[tipo].namespace}"`);
      expect(xml).toContain(`${TIPO_DOC[tipo].namespace} https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/${TIPO_DOC[tipo].xsd}`);
    }
  });

  test('el XML de cada tipo parsea como XML valido (bien formado)', () => {
    for (const tipo of Object.keys(TIPO_DOC)) {
      const xml = buildXml(hacerFactura(tipo));
      expect(() => parser.parse(xml)).not.toThrow();
    }
  });

  test('FE contiene <FacturaElectronica>, <Clave> y CABYS de 13 digitos', () => {
    const xml = buildXml(hacerFactura('FE'));
    expect(xml).toContain('<Clave>');
    expect(xml).toContain('<Codigo>0212010100100</Codigo>');
    expect(xml).toContain('<Receptor>');
  });

  test('TE no contiene <Receptor>', () => {
    const xml = buildXml(hacerFactura('TE'));
    expect(xml).not.toContain('<Receptor>');
  });

  test('NC contiene <InformacionReferencia> y <MontoTotalImpuestoAcreditar>', () => {
    const xml = buildXml(hacerFactura('NC'));
    expect(xml).toContain('<InformacionReferencia>');
    expect(xml).toContain(`<Numero>${REFERENCIA}</Numero>`);
    expect(xml).toContain('<MontoTotalImpuestoAcreditar>500.00</MontoTotalImpuestoAcreditar>');
  });

  test('ND contiene <MontoTotalImpuestoDebitar>', () => {
    const xml = buildXml(hacerFactura('ND'));
    expect(xml).toContain('<MontoTotalImpuestoDebitar>500.00</MontoTotalImpuestoDebitar>');
  });

  test('REP usa <DetalleMensaje> y no lleva <LineaDetalle> ni <Receptor>', () => {
    const xml = buildXml(hacerFactura('REP'));
    expect(xml).toContain('<DetalleMensaje>');
    expect(xml).toContain(`<Clave>${REFERENCIA}</Clave>`);
    expect(xml).not.toContain('<LineaDetalle>');
    expect(xml).not.toContain('<Receptor>');
  });

  test('lanza error con tipo de documento no soportado', () => {
    expect(() => buildXml(hacerFactura('XX'))).toThrow(/no soportado/i);
  });

  test('lanza error con clave numerica invalida', () => {
    const f = hacerFactura('FE', { claveNumerica: '123' });
    expect(() => buildXml(f)).toThrow(/claveNumerica invalida/i);
  });

  test('lanza error con consecutivo invalido', () => {
    const f = hacerFactura('FE', { consecutivo: '12' });
    expect(() => buildXml(f)).toThrow(/consecutivo invalido/i);
  });
});
