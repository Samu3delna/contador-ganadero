import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(FRONTEND, '..');

const leer = (...partes) => readFileSync(path.join(...partes), 'utf8');
const leerJson = (...partes) => JSON.parse(leer(...partes));

// Versiones mayores de Node instalables por el build de Cloudflare (Workers Builds).
// Node 26.13.0 en .nvmrc rompía el paso "Installing nodejs". Actualizar al validar una nueva LTS.
const NODE_MAJOR_SOPORTADAS = [22, 24];

const parseVersion = (v) => v.trim().replace(/^v/, '').split('.').map(Number);
const compararVersion = (a, b) => {
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
};

/** Convierte la línea Content-Security-Policy en { directiva: [fuentes] } */
function parsearCsp(valor) {
  const directivas = {};
  for (const parte of valor.split(';')) {
    const [nombre, ...fuentes] = parte.trim().split(/\s+/).filter(Boolean);
    if (nombre) directivas[nombre.toLowerCase()] = fuentes;
  }
  return directivas;
}

/** Indica si una URL está permitida por una lista de fuentes CSP (host exacto o comodín *.dominio). */
function permitidaPorCsp(url, fuentes) {
  const { protocol, host } = new URL(url);
  return fuentes.some((fuente) => {
    if (!/^https?:\/\//.test(fuente)) return false;
    const { protocol: proto, host: hostFuente } = new URL(fuente.replace('*.', 'comodin.'));
    if (proto !== protocol) return false;
    if (fuente.includes('://*.')) {
      const dominio = hostFuente.replace(/^comodin\./, '');
      return host.endsWith(`.${dominio}`);
    }
    return host === hostFuente;
  });
}

function listarArchivos(dir, extensiones) {
  const resultado = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) resultado.push(...listarArchivos(ruta, extensiones));
    else if (extensiones.some((ext) => nombre.endsWith(ext))) resultado.push(ruta);
  }
  return resultado;
}

/** Scripts externos que carga la app: <script src> en index.html + URLs de scripts en src/. */
function scriptsExternosDeLaApp() {
  const urls = new Set();
  const html = leer(FRONTEND, 'index.html');
  for (const [, src] of html.matchAll(/<script[^>]+src="(https:\/\/[^"]+)"/g)) urls.add(src);

  const patronScript = /https:\/\/[a-z0-9.-]+\/[^\s'"`$]*?(?:\.js|\/gtag\/js)(?=[\s'"`?$]|$)/gi;
  for (const archivo of listarArchivos(path.join(FRONTEND, 'src'), ['.js', '.jsx'])) {
    for (const [url] of leer(archivo).matchAll(patronScript)) urls.add(url);
  }
  // Inyectado automáticamente por Cloudflare Web Analytics en producción.
  urls.add('https://static.cloudflareinsights.com/beacon.min.js');
  return [...urls];
}

describe('Versión de Node para el build de Cloudflare', () => {
  const nvmrc = leer(RAIZ, '.nvmrc').trim();
  const nodeVersion = leer(RAIZ, '.node-version').trim();

  test('.nvmrc y .node-version tienen una versión semver completa', () => {
    assert.match(nvmrc, /^v?\d+\.\d+\.\d+$/);
    assert.match(nodeVersion, /^v?\d+\.\d+\.\d+$/);
  });

  test('.nvmrc y .node-version coinciden', () => {
    assert.deepEqual(parseVersion(nvmrc), parseVersion(nodeVersion));
  });

  test('la versión mayor de Node es una LTS instalable por Cloudflare (no 26.x)', () => {
    const [major] = parseVersion(nvmrc);
    assert.ok(
      NODE_MAJOR_SOPORTADAS.includes(major),
      `Node ${nvmrc} no está en las versiones soportadas ${NODE_MAJOR_SOPORTADAS.join(', ')}`,
    );
  });

  for (const pkg of ['package.json', 'backend/package.json', 'frontend/package.json']) {
    test(`engines.node de ${pkg} acepta la versión fijada en .nvmrc`, () => {
      const { engines } = leerJson(RAIZ, pkg);
      assert.ok(engines?.node, `${pkg} no define engines.node`);
      const minimo = engines.node.match(/^>=\s*(\d+\.\d+\.\d+)$/);
      assert.ok(minimo, `engines.node con formato inesperado en ${pkg}: ${engines.node}`);
      assert.ok(
        compararVersion(parseVersion(nvmrc), parseVersion(minimo[1])) >= 0,
        `.nvmrc (${nvmrc}) no cumple ${engines.node} de ${pkg}`,
      );
    });
  }

  test('engines.node exige al menos Node 22.12 (requisito de Vite 8)', () => {
    const { engines } = leerJson(FRONTEND, 'package.json');
    const [, minimo] = engines.node.match(/(\d+\.\d+\.\d+)/);
    assert.ok(compararVersion(parseVersion(minimo), [22, 12, 0]) >= 0);
  });
});

describe('Sin restos de Vercel ni Docker', () => {
  const prohibidos = [
    'vercel.json',
    'frontend/vercel.json',
    '.vercel',
    'frontend/.vercel',
    '.vercelignore',
    'Dockerfile',
    'frontend/Dockerfile',
    'backend/Dockerfile',
    '.dockerignore',
    'frontend/.dockerignore',
    'backend/.dockerignore',
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
    'frontend/nginx-frontend.conf',
  ];

  for (const archivo of prohibidos) {
    test(`no existe ${archivo}`, () => {
      assert.equal(existsSync(path.join(RAIZ, archivo)), false);
    });
  }

  test('los scripts npm no invocan vercel ni docker', () => {
    for (const pkg of ['package.json', 'backend/package.json', 'frontend/package.json']) {
      const scripts = JSON.stringify(leerJson(RAIZ, pkg).scripts || {});
      assert.doesNotMatch(scripts, /vercel|docker/i, `scripts de ${pkg}`);
    }
  });
});

function parsearJsonc(texto) {
  const sinComentarios = texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(sinComentarios);
}

describe('Configuración de Cloudflare Workers Static Assets (wrangler)', () => {
  const casos = [
    { carpeta: RAIZ, etiqueta: 'raíz', directorio: './frontend/dist' },
    { carpeta: FRONTEND, etiqueta: 'frontend', directorio: './dist' },
  ];

  for (const { carpeta, etiqueta, directorio } of casos) {
    test(`configuración wrangler en ${etiqueta} sirve ${directorio} como SPA`, () => {
      const rutaJsonc = path.join(carpeta, 'wrangler.jsonc');
      const rutaToml = path.join(carpeta, 'wrangler.toml');
      const tieneJsonc = existsSync(rutaJsonc);
      const tieneToml = existsSync(rutaToml);

      assert.ok(tieneJsonc || tieneToml, `falta wrangler.jsonc o wrangler.toml en ${etiqueta}`);
      assert.ok(!(tieneJsonc && tieneToml), `coexisten wrangler.jsonc y wrangler.toml en ${etiqueta}`);

      if (tieneJsonc) {
        const cfg = parsearJsonc(readFileSync(rutaJsonc, 'utf8'));
        assert.equal(cfg.name, 'contador-ganadero');
        assert.match(cfg.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(cfg.assets?.directory, directorio);
        assert.equal(cfg.assets?.not_found_handling, 'single-page-application');
      } else {
        const toml = readFileSync(rutaToml, 'utf8');
        assert.match(toml, /^name\s*=\s*"contador-ganadero"/m);
        assert.match(toml, /^compatibility_date\s*=\s*"\d{4}-\d{2}-\d{2}"/m);
        assert.match(toml, /^\[assets\]/m);
        assert.match(toml, new RegExp(`^directory\\s*=\\s*"${directorio.replace(/[./]/g, '\\$&')}"`, 'm'));
        assert.match(toml, /^not_found_handling\s*=\s*"single-page-application"/m);
      }
    });
  }
});

describe('Cabeceras de seguridad y CSP (frontend/public/_headers)', () => {
  const contenido = leer(FRONTEND, 'public', '_headers');
  const lineas = contenido.split(/\r?\n/);
  const lineaCsp = lineas.find((l) => /^\s+Content-Security-Policy:/.test(l));
  const csp = parsearCsp(lineaCsp.replace(/^\s+Content-Security-Policy:\s*/, ''));

  test('aplica las cabeceras a todas las rutas', () => {
    assert.equal(lineas[0].trim(), '/*');
  });

  test('ninguna línea supera el límite de 2000 caracteres de Cloudflare', () => {
    for (const linea of lineas) assert.ok(linea.length <= 2000, `línea de ${linea.length} caracteres`);
  });

  test('mantiene las cabeceras de endurecimiento', () => {
    assert.match(contenido, /X-Frame-Options: DENY/);
    assert.match(contenido, /X-Content-Type-Options: nosniff/);
    assert.match(contenido, /Strict-Transport-Security: max-age=31536000/);
    assert.match(contenido, /Referrer-Policy: strict-origin-when-cross-origin/);
  });

  test('la CSP conserva las restricciones base', () => {
    assert.deepEqual(csp['default-src'], ["'self'"]);
    assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
    assert.deepEqual(csp['object-src'], ["'none'"]);
    assert.deepEqual(csp['base-uri'], ["'self'"]);
    assert.ok(csp['script-src'].includes("'self'"));
  });

  test('script-src no permite inline, eval ni comodines abiertos', () => {
    for (const peligroso of ["'unsafe-inline'", "'unsafe-eval'", '*', 'https:', 'http:', 'data:']) {
      assert.ok(!csp['script-src'].includes(peligroso), `script-src contiene ${peligroso}`);
    }
  });

  test('permite el beacon de Cloudflare Web Analytics', () => {
    const beacon =
      'https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092';
    assert.ok(permitidaPorCsp(beacon, csp['script-src']));
    assert.ok(permitidaPorCsp('https://cloudflareinsights.com/cdn-cgi/rum', csp['connect-src']));
  });

  test('permite el script e iframes de Google AdSense', () => {
    const adsense =
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1077407420035302';
    assert.ok(permitidaPorCsp(adsense, csp['script-src']));
    assert.ok(permitidaPorCsp('https://tpc.googlesyndication.com/sodar/sodar2.js', csp['script-src']));
    assert.ok(permitidaPorCsp('https://googleads.g.doubleclick.net/pagead/ads', csp['frame-src']));
    assert.ok(permitidaPorCsp('https://tpc.googlesyndication.com/safeframe/1-0-40/html/container.html', csp['frame-src']));
    assert.ok(permitidaPorCsp('https://ep1.adtrafficquality.google/getconfig/sodar', csp['connect-src']));
  });

  test('permite Google Analytics 4 y el SDK de ONVO Pay', () => {
    assert.ok(permitidaPorCsp('https://www.googletagmanager.com/gtag/js?id=G-TEST', csp['script-src']));
    assert.ok(permitidaPorCsp('https://region1.google-analytics.com/g/collect', csp['connect-src']));
    assert.ok(permitidaPorCsp('https://sdk.onvopay.com/sdk.js', csp['script-src']));
    assert.ok(permitidaPorCsp('https://checkout.onvopay.com/', csp['frame-src']));
  });

  test('permite las llamadas a la API de Render (login) y fuentes de Google', () => {
    assert.ok(permitidaPorCsp('https://contador-ganadero.onrender.com/api/auth/login', csp['connect-src']));
    assert.ok(permitidaPorCsp('https://fonts.googleapis.com/css2?family=Outfit', csp['style-src']));
    assert.ok(permitidaPorCsp('https://fonts.gstatic.com/s/outfit/v1/a.woff2', csp['font-src']));
  });

  test('todos los scripts externos que carga la app están permitidos por script-src', () => {
    const scripts = scriptsExternosDeLaApp();
    assert.ok(scripts.length >= 4, `se esperaban varios scripts externos, hallados: ${scripts}`);
    const bloqueados = scripts.filter((url) => !permitidaPorCsp(url, csp['script-src']));
    assert.deepEqual(bloqueados, [], `scripts bloqueados por la CSP: ${bloqueados.join(', ')}`);
  });

  test('no permite orígenes ajenos (ej. vercel.app) en script-src ni connect-src', () => {
    assert.equal(permitidaPorCsp('https://evil.vercel.app/x.js', csp['script-src']), false);
    assert.equal(permitidaPorCsp('https://evil.example.com/x.js', csp['script-src']), false);
    assert.equal(permitidaPorCsp('https://evil.example.com/api', csp['connect-src']), false);
    // El comodín *.google.com no debe cubrir dominios que solo terminan igual
    assert.equal(permitidaPorCsp('https://evilgoogle.com/x.js', csp['script-src']), false);
  });
});
