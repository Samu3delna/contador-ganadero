// The upstream package is ESM; keep the rest of the Express application CommonJS.
let sdkPromise;

function cargarSdk() {
  if (!sdkPromise) {
    sdkPromise = import('@dojocoding/hacienda-sdk').catch((error) => {
      sdkPromise = undefined;
      throw error;
    });
  }
  return sdkPromise;
}

module.exports = { cargarSdk };
