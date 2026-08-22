/**
 * Tests unitarios del generador de Clave Numerica de 50 digitos (v4.4).
 */

const { generarClave, generarConsecutivo, padCedula, TIPO_DOC_CODIGO } = require('../services/hacienda/clave50');

describe('clave50', () => {
  test('genera una clave de exactamente 50 digitos numericos', () => {
    const { clave } = generarClave({
      fecha: new Date(),
      tipoDocumento: 'FE',
      cedulaEmisor: '123456789',
      tipoCedula: '01',
    });
    expect(clave).toHaveLength(50);
    expect(clave).toMatch(/^[0-9]{50}$/);
    expect(clave.startsWith('506')).toBe(true);
  });

  test('genera consecutivo de 20 digitos con digito de tipo correcto', () => {
    for (const [tipo, codigo] of Object.entries(TIPO_DOC_CODIGO)) {
      const consecutivo = generarConsecutivo({ tipoDocumento: tipo, secuencia: 7 });
      expect(consecutivo).toHaveLength(20);
      expect(consecutivo).toMatch(/^[0-9]{20}$/);
      // posiciones 9-10 (index 8-9) = tipo de documento
      expect(consecutivo.slice(8, 10)).toBe(codigo);
      // secuencia en las ultimas 10 posiciones
      expect(consecutivo.slice(-10)).toBe('0000000007');
    }
  });

  test('hace padding de cedula a 12 digitos', () => {
    expect(padCedula('123456789')).toBe('000123456789');
    expect(padCedula('3101234567')).toBe('003101234567');
  });

  test('rechaza cedula vacia', () => {
    expect(() =>
      generarClave({ fecha: new Date(), tipoDocumento: 'FE', cedulaEmisor: '' })
    ).toThrow(/cedulaEmisor/i);
  });

  test('rechaza tipo de documento desconocido cayendo a FE (01)', () => {
    const consecutivo = generarConsecutivo({ tipoDocumento: 'XX', secuencia: 1 });
    expect(consecutivo.slice(8, 10)).toBe('01');
  });
});
