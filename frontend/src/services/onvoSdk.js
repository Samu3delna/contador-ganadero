const SDK_URL = 'https://sdk.onvopay.com/sdk.js';
let sdkPromise = null;

export function cargarSdkOnvo() {
  if (window.onvo?.pay) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      const fail = () => { script.remove(); reject(new Error('No se pudo cargar el SDK de ONVO')); };
      script.onload = () => window.onvo?.pay ? resolve() : fail();
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch(error => { sdkPromise = null; throw error; });
  }
  return sdkPromise;
}
