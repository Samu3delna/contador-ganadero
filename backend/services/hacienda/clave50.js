/**
 * Generador de Clave Numerica de 50 digitos (v4.4 Hacienda CR)
 *
 * Estructura oficial (50 posiciones):
 *  pos 1-3    : codigo pais (506)
 *  pos 4-9    : fecha DDMMYY (6 digitos)
 *  pos 10-21  : identificacion emisor padded a 12 (fisica 9->12, juridica 10->12)
 *  pos 22-41  : consecutivo completo de 20 digitos
 *  pos 42-50  : codigo de seguridad (9 digitos numericos)
 *
 * Consecutivo de 20 digitos:
 *  pos 1-3  : sucursal (3)
 *  pos 4-8  : terminal (5)
 *  pos 9-10 : tipo documento (01 FE, 02 TE, 03 NC, 04 ND, 05 FEC, 06 REP)
 *  pos 11-20 : secuencia (10)
 */

const TIPO_DOC_CODIGO = {
  FE: '01',
  TE: '02',
  NC: '03',
  ND: '04',
  FEC: '05',
  REP: '06',
};

/**
 * Padding de cedula segun tipo:
 *  Fisica (01)        -> 9 digitos -> padStart(12, '0')
 *  Juridica (02)      -> 10 digitos -> padStart(12, '0')
 *  DIMEX (03)         -> 11 o 12 digitos -> padStart(12, '0')
 *  NITE (04)          -> 10 digitos -> padStart(12, '0')
 */
function padCedula(numero, _tipo) {
  const limpio = String(numero || '').replace(/[^0-9]/g, '');
  return limpio.padStart(12, '0').slice(-12);
}

/**
 * Genera consecutivo de 20 digitos.
 * sucursal (3) + terminal (5) + tipo (2) + secuencia (10)
 */
function generarConsecutivo({ sucursal = '001', terminal = '00001', tipoDocumento = 'FE', secuencia = 1 } = {}) {
  const tipo = TIPO_DOC_CODIGO[tipoDocumento] || '01';
  const suc = String(sucursal).padStart(3, '0').slice(0, 3);
  const ter = String(terminal).padStart(5, '0').slice(0, 5);
  const seq = String(secuencia).padStart(10, '0').slice(-10);
  return `${suc}${ter}${tipo}${seq}`;
}

/**
 * Genera la clave numerica de 50 digitos.
 */
function generarClave({
  fecha = new Date(),
  tipoDocumento = 'FE',
  cedulaEmisor,
  tipoCedula = '01',
  sucursal = '001',
  terminal = '00001',
  secuencia = 1,
  codigoSeguridad,
} = {}) {
  if (!cedulaEmisor) throw new Error('cedulaEmisor es obligatoria para la clave');

  const pais = '506';
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = String(fecha.getFullYear()).slice(-2);
  const fechaStr = `${dia}${mes}${anio}`;

  const cedulaPadded = padCedula(cedulaEmisor, tipoCedula);

  const consecutivo = generarConsecutivo({ sucursal, terminal, tipoDocumento, secuencia });

  //Codigo de seguridad de 9 digitos
  const seg = codigoSeguridad != null
    ? String(codigoSeguridad).padStart(9, '0').slice(-9)
    : String(Math.floor(100000000 + Math.random() * 900000000)).slice(0, 9);

  const clave = `${pais}${fechaStr}${cedulaPadded}${consecutivo}${seg}`;
  if (clave.length !== 50) {
    throw new Error(`Clave generada con longitud incorrecta: ${clave.length}`);
  }
  if (!/^[0-9]{50}$/.test(clave)) {
    throw new Error('Clave generada con caracteres no numericos');
  }
  return { clave, consecutivo, codigoSeguridad: seg };
}

module.exports = {
  TIPO_DOC_CODIGO,
  generarClave,
  generarConsecutivo,
  padCedula,
};

