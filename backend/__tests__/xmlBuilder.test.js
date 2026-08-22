/**
 * Tests unitarios del generador de XML v4.4 (FE, TE, NC, ND, FEC, REP).
 *
 * No requiere MongoDB: son tests puros de strings + parseo XML.
 * Alineados con la implementación actual de xmlBuilder.js (TIPO_DOC_CONFIG).
 */

const { XMLParser } = require('fast-xml-parser');
const { buildXml, TIPO_DOC_CONFIG, TIPO_DOC_CODIGO } = require('../services/hacienda/xmlBuilder');
const { generarClave } = require('../services/hacienda/clave50');

const parser = new XMLParser({ ignoreAttributes: false });

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
    ...overrides,
  };
}

describe('xmlBuilder.buildXml', () => {
  test('cada tipo produce su nodo raiz, namespace y schemaLocation correctos', () => {
    for (const [tipo, config] of Object.entries(TIPO_DOC_CONFIG)) {
      const xml = buildXml(hacerFactura(tipo));
      expect(xml).toContain(`<${config.rootElement}`);
      expect(xml).toContain(`xmlns="${config.namespace}"`);
      expect(xml).toContain(`xsi:schemaLocation="${config.namespace} ${config.schemaLocation}"`);
    }
  });

  test('REP usa <ReciboElectronicoPago> (esquema propio de v4.4)', () => {
    expect(TIPO_DOC_CONFIG.REP.rootElement).toBe('ReciboElectronicoPago');
    const xml = buildXml(hacerFactura('REP'));
    expect(xml).toContain('<ReciboElectronicoPago');
  });

  test('el XML de cada tipo parsea como XML valido (bien formado)', () => {
    for (const tipo of Object.keys(TIPO_DOC_CONFIG)) {
      const xml = buildXml(hacerFactura(tipo));
      expect(() => parser.parse(xml)).not.toThrow();
    }
  });

  test('FE contiene <Clave>, CABYS de 13 digitos y <Receptor>', () => {
    const xml = buildXml(hacerFactura('FE'));
    expect(xml).toContain('<Clave>');
    expect(xml).toContain('<Codigo>0212010100100</Codigo>');
    expect(xml).toContain('<Receptor>');
  });

  test('TE no contiene <Receptor>', () => {
    const xml = buildXml(hacerFactura('TE'));
    expect(xml).not.toContain('<Receptor>');
  });

  test('el codigo de tipo de documento es consistente (01..06)', () => {
    expect(TIPO_DOC_CODIGO).toEqual({
      FE: '01', TE: '02', NC: '03', ND: '04', FEC: '05', REP: '06',
    });
  });

  test('lanza error con clave numerica invalida', () => {
    const f = hacerFactura('FE', { claveNumerica: '123' });
    expect(() => buildXml(f)).toThrow(/claveNumerica invalida/i);
  });

  test('lanza error con consecutivo invalido', () => {
    const f = hacerFactura('FE', { consecutivo: '12' });
    expect(() => buildXml(f)).toThrow(/consecutivo invalido/i);
  });

  test('tipo de documento desconocido cae a FE', () => {
    const f = hacerFactura('FE', { tipoDocumento: 'XX' });
    const xml = buildXml(f);
    expect(xml).toContain('<FacturaElectronica');
  });
});
