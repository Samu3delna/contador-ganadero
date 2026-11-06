import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { resolvePageSeo, SITE_ORIGIN } from '../src/config/seoCatalog.js';

const routes = [
  '/',
  '/producto',
  ...['dashboard', 'facturas', 'ingresos', 'gastos', 'inventario', 'costos', 'impuestos'].map(s => `/producto/${s}`),
  '/tutoriales',
  '/academia',
  '/precios',
  '/preguntas-frecuentes',
  '/contacto',
  '/soluciones',
];
const legalSitemapRoutes = ['/privacidad', '/terminos', '/condiciones-servicio', '/eliminacion-datos'];

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { render } = await server.ssrLoadModule('/src/entry-public.jsx');
  for (const library of ['/academia', '/tutoriales']) {
    const dom = new JSDOM(await render(library));
    for (const a of dom.window.document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (href.startsWith(`${library}/`) && !routes.includes(href)) routes.push(href);
    }
    dom.window.close();
  }
  const template = await readFile('dist/index.html', 'utf8');
  for (const route of routes) {
    const markup = await render(route);
    const dom = new JSDOM(template);
    const { document } = dom.window;
    document.getElementById('root').innerHTML = markup;
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
  await server.close();
}
