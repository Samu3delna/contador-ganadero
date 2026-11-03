/** Claves v4.4: país + fecha CR + identificación + consecutivo + situación + seguridad. */
const crypto = require('node:crypto');
const { cargarSdk } = require('./sdkLoader');

const TIPO_DOC_CODIGO = Object.freeze({ FE: '01', ND: '02', NC: '03', TE: '04', FEC: '08', REP: '10' });

function padCedula(numero, tipo) {
  const identificacion = String(numero ?? '').trim();
  if (!/^[A-Za-z0-9]{9,12}$/.test(identificacion) || (/[A-Za-z]/.test(identificacion) && tipo !== '02')) {
    throw new Error('cedulaEmisor debe tener entre 9 y 12 caracteres válidos; letras solo para identificación jurídica');
  }
  return identificacion.padStart(12, '0');
}

function segmento(value, longitud, nombre) {
  const texto = String(value);
  if (!new RegExp('^\\d{1,' + longitud + '}$').test(texto) || Number(texto) < 1) {
    throw new Error(nombre + ' debe tener entre 1 y ' + longitud + ' dígitos y ser mayor que cero');
  }
  return texto.padStart(longitud, '0');
}

/** La asignación atómica de la secuencia pertenece a MongoDB, no al SDK en disco. */
function generarConsecutivo({ sucursal = '001', terminal = '00001', tipoDocumento = 'FE', secuencia = 1 } = {}) {
  if (!Object.hasOwn(TIPO_DOC_CODIGO, tipoDocumento)) throw new Error('Tipo de documento desconocido');
  return segmento(sucursal, 3, 'sucursal') + segmento(terminal, 5, 'terminal') + TIPO_DOC_CODIGO[tipoDocumento] + segmento(secuencia, 10, 'secuencia');
}

async function generarClave({
  fecha = new Date(), tipoDocumento = 'FE', cedulaEmisor, tipoCedula = '01',
  sucursal = '001', terminal = '00001', secuencia = 1, codigoSeguridad, situacion = '1',
} = {}) {
  padCedula(cedulaEmisor, tipoCedula);
  const consecutivo = generarConsecutivo({ sucursal, terminal, tipoDocumento, secuencia });
  const seguridad = codigoSeguridad == null
    ? String(crypto.randomInt(0, 100000000)).padStart(8, '0')
    : String(codigoSeguridad).padStart(8, '0');
  if (!/^\d{8}$/.test(seguridad)) throw new Error('codigoSeguridad debe tener hasta 8 dígitos');
  const { buildClave } = await cargarSdk();
  const clave = buildClave({
    date: fecha instanceof Date ? fecha : new Date(fecha),
    taxpayerId: String(cedulaEmisor).trim(),
    branch: consecutivo.slice(0, 3), pos: consecutivo.slice(3, 8),
    documentType: TIPO_DOC_CODIGO[tipoDocumento], sequence: Number(secuencia),
    situation: situacion, securityCode: seguridad,
  });
  return { clave, consecutivo, codigoSeguridad: seguridad, situacion };
}

module.exports = { TIPO_DOC_CODIGO, generarClave, generarConsecutivo, padCedula };
