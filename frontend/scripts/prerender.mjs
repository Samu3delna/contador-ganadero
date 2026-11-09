import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile, mkdir, readdir, mkdtemp, rm } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { resolvePageSeo, SITE_ORIGIN } from '../src/config/seoCatalog.js';

const routes = [
  '/',
  '/producto',
  ...['dashboard', 'facturas', 'ingresos', 'gastos', 'inventario', 'costos', 'impuestos'].map(s => `/producto/${s}`),
  '/precios',
  '/preguntas-frecuentes',
  '/contacto',
  '/soluciones',
];
const legalSitemapRoutes = ['/privacidad', '/terminos', '/condiciones-servicio', '/eliminacion-datos'];

// Bundle SSR dependencies together so Node cannot load a second React from
// the mobile workspace through hoisted router packages.
const renderDir = await mkdtemp(path.resolve('.prerender-'));
try {
  await build({
    ssr: { noExternal: true },
    build: {
      ssr: 'src/entry-public.jsx',
      outDir: renderDir,
      rolldownOptions: { output: { entryFileNames: 'render.mjs' } },
    },
  });
  const { render } = await import(pathToFileURL(path.join(renderDir, 'render.mjs')).href);
  const template = await readFile('dist/index.html', 'utf8');
  const publicCss = (await readdir('dist/assets')).filter(name => /^LandingPage-.*\.css$/.test(name));
  for (const route of routes) {
    const markup = await render(route);
    const dom = new JSDOM(template);
    const { document } = dom.window;
    document.getElementById('root').innerHTML = markup;
    for (const name of publicCss) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `/assets/${name}`; document.head.append(link);
    }
    const heading = document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!heading) throw new Error(`No H1: ${route}`);
    const seo = resolvePageSeo(route, document);
    document.title = seo.title;
    for (const [attr, key, value] of [
      ['name', 'description', seo.description],
      ['name', 'keywords', seo.keywords],
      ['name', 'robots', 'index, follow'],
      ['property', 'og:site_name', 'ContadorGanadero'],
      ['property', 'og:title', seo.title],
      ['property', 'og:description', seo.description],
      ['property', 'og:url', seo.canonical],
      ['property', 'og:type', seo.ogType],
      ['property', 'og:image', seo.image],
      ['property', 'og:image:alt', 'Logo oficial de ContadorGanadero — Contador ganadero y contabilidad ganadera en Costa Rica'],
      ['name', 'twitter:card', 'summary_large_image'],
      ['name', 'twitter:title', seo.title],
      ['name', 'twitter:description', seo.description],
      ['name', 'twitter:image', seo.image],
    ]) {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.append(el);
      }
      el.content = value;
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = seo.canonical;
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': seo.ogType === 'article' ? 'Article' : 'WebPage',
      name: seo.title,
      headline: heading,
      url: seo.canonical,
      description: seo.description,
      inLanguage: 'es-CR',
      isPartOf: {
        '@type': 'WebSite',
        name: 'ContadorGanadero',
        alternateName: ['Contador Ganadero', 'Contador Ganadera', 'contadorganadero.com', 'Contabilidad Ganadera Costa Rica'],
        url: SITE_ORIGIN,
      },
      publisher: {
        '@type': 'Organization',
        name: 'ContadorGanadero',
        url: SITE_ORIGIN,
        logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo.png` },
      },
    }).replace(/</g, '\\u003c');
    document.head.append(schema);
    const file = path.join('dist', route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, dom.serialize());
    dom.window.close();
  }
  const allSitemapRoutes = [...routes, ...legalSitemapRoutes];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${allSitemapRoutes.map(route => `\n<url><loc>${SITE_ORIGIN}${route}</loc></url>`).join('')}\n</urlset>\n`;
  await writeFile('public/sitemap.xml', sitemap);
  await writeFile('dist/sitemap.xml', sitemap);
  console.log(`Prerender: ${routes.length} public pages (${allSitemapRoutes.length} sitemap URLs).`);
} finally {
  await rm(renderDir, { recursive: true, force: true });
}
