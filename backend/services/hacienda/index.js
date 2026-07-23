/**
 * Index de servicios Hacienda — fachada unica.
 */

module.exports = {
  clave50: require('./clave50'),
  xmlBuilder: require('./xmlBuilder'),
  signer: require('./signer'),
  auth: require('./auth'),
  recepcion: require('./recepcion'),
  mockStore: require('./mockStore'),
};
