const { buildXml, mapearDocumento, TIPO_DOC_CONFIG } = require('../services/hacienda/xmlBuilder');
describe('rechazo temprano de comprobantes incompletos', () => {
  test.each(['XX', '__proto__'])('no transforma %s silenciosamente en FE', tipoDocumento => {
    expect(() => mapearDocumento({ tipoDocumento })).toThrow(/desconocido/);
  });
  test('rechaza clave numérica dañada antes de construir XML', async () => {
    await expect(buildXml({ tipoDocumento: 'FE', claveNumerica: '123' })).rejects.toThrow(/claveNumerica/);
  });
  test('REP tiene su propio esquema, separado del mensaje receptor', () => {
    expect(TIPO_DOC_CONFIG.REP.rootElement).toBe('ReciboElectronicoPago');
    expect(TIPO_DOC_CONFIG.REP.namespace).toContain('/xml-schemas/v4.4/reciboElectronicoPago');
  });
});
