const { generarClave, generarConsecutivo, padCedula, TIPO_DOC_CODIGO } = require('../services/hacienda/clave50');
describe('contrato de consecutivos v4.4', () => {
  test('usa los códigos oficiales, sin convertir REP en mensaje receptor', () => {
    expect(TIPO_DOC_CODIGO).toEqual({ FE: '01', ND: '02', NC: '03', TE: '04', FEC: '08', REP: '10' });
    for (const [tipoDocumento, codigo] of Object.entries(TIPO_DOC_CODIGO)) {
      const consecutivo = generarConsecutivo({ tipoDocumento, secuencia: 7 });
      expect(consecutivo).toHaveLength(20);
      expect(consecutivo.slice(8,10)).toBe(codigo);
      expect(consecutivo.slice(-10)).toBe('0000000007');
    }
  });
  test('conserva ceros iniciales y rechaza identidades vacías', async () => {
    expect(padCedula('123456789')).toBe('000123456789');
    await expect(generarClave({ cedulaEmisor: '' })).rejects.toThrow(/cedulaEmisor/);
  });
  test.each(['XX', '__proto__'])('rechaza tipo %s', tipoDocumento => {
    expect(() => generarConsecutivo({ tipoDocumento })).toThrow(/desconocido/);
  });
  test.each([0,-1,1.5,1e10,NaN])('rechaza secuencia inválida %s', secuencia => {
    expect(() => generarConsecutivo({ secuencia })).toThrow(/secuencia/);
  });
});
