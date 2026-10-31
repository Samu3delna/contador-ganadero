import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverApiUrl, API_URL_PRODUCCION } from '../src/services/apiUrl.js';

test('usa VITE_API_URL cuando está definida', () => {
  assert.equal(
    resolverApiUrl({ VITE_API_URL: 'https://contador-ganadero.onrender.com/api', PROD: true }),
    'https://contador-ganadero.onrender.com/api',
  );
});

test('agrega /api si VITE_API_URL no lo incluye', () => {
  assert.equal(
    resolverApiUrl({ VITE_API_URL: 'https://contador-ganadero.onrender.com' }),
    'https://contador-ganadero.onrender.com/api',
  );
});

test('elimina barras finales y espacios de VITE_API_URL', () => {
  assert.equal(
    resolverApiUrl({ VITE_API_URL: '  https://contador-ganadero.onrender.com/api///  ' }),
    'https://contador-ganadero.onrender.com/api',
  );
  assert.equal(
    resolverApiUrl({ VITE_API_URL: 'https://contador-ganadero.onrender.com/' }),
    'https://contador-ganadero.onrender.com/api',
  );
});

test('en producción sin VITE_API_URL usa la API de Render (no el SPA de Cloudflare)', () => {
  assert.equal(resolverApiUrl({ PROD: true }), API_URL_PRODUCCION);
  assert.equal(resolverApiUrl({ PROD: true, VITE_API_URL: '' }), API_URL_PRODUCCION);
  assert.equal(resolverApiUrl({ PROD: true, VITE_API_URL: '   ' }), API_URL_PRODUCCION);
  assert.equal(API_URL_PRODUCCION, 'https://contador-ganadero.onrender.com/api');
});

test('en desarrollo sin VITE_API_URL usa el proxy relativo /api de Vite', () => {
  assert.equal(resolverApiUrl({ PROD: false }), '/api');
  assert.equal(resolverApiUrl({}), '/api');
  assert.equal(resolverApiUrl(), '/api');
});

test('ignora valores no string en VITE_API_URL', () => {
  assert.equal(resolverApiUrl({ VITE_API_URL: undefined, PROD: true }), API_URL_PRODUCCION);
  assert.equal(resolverApiUrl({ VITE_API_URL: null, PROD: false }), '/api');
});

test('el resultado nunca termina en barra', () => {
  const casos = [
    {},
    { PROD: true },
    { VITE_API_URL: 'http://localhost:5000/api/' },
    { VITE_API_URL: 'http://localhost:5000/' },
  ];
  for (const env of casos) {
    assert.ok(!resolverApiUrl(env).endsWith('/'), `termina en "/" para ${JSON.stringify(env)}`);
  }
});
