import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';

const origin = 'https://contadorganadero.com';
const titles = {
  '/': 'Administración agropecuaria para Costa Rica',
  '/producto': 'Conoce el producto', '/producto/dashboard': 'Dashboard financiero',
  '/producto/facturas': 'Organiza tus facturas XML', '/producto/ingresos': 'Registro de ingresos',
  '/producto/gastos': 'Organiza los gastos de tu finca', '/producto/inventario': 'Inventario agropecuario',
  '/producto/costos': 'Costos de producción', '/producto/impuestos': 'Información para tus impuestos',
  '/tutoriales': 'Tutoriales paso a paso', '/academia': 'Academia agropecuaria',
  '/precios': 'Planes Gratis y Pro', '/soluciones': 'Soluciones para productores y contadores',
  '/contacto': 'Contacto', '/preguntas-frecuentes': 'Preguntas frecuentes',
};
const routes = ['/', '/producto', ...['dashboard','facturas','ingresos','gastos','inventario','costos','impuestos'].map(s => `/producto/${s}`), '/tutoriales', '/academia', '/precios', '/preguntas-frecuentes', '/contacto', '/soluciones'];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { render } = await server.ssrLoadModule('/src/entry-public.jsx');
  // Discover article URLs from actual library links, keeping one source of truth.
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
    const pageTitle = titles[route] || heading;
    document.title = `${pageTitle} | ContadorGanadero`;
    const description = document.querySelector('main p')?.textContent?.slice(0,170) || heading;
    for (const [attr, key, value] of [['name','description',description],['name','robots','index, follow'],['property','og:title',document.title],['property','og:description',description],['property','og:url',origin+route],['property','og:type',route.startsWith('/academia/')?'article':'website'],['name','twitter:card','summary'],['name','twitter:title',document.title],['name','twitter:description',description]]) {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el=document.createElement('meta'); el.setAttribute(attr,key); document.head.append(el); }
      el.content=value;
    }
    let canonical=document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical=document.createElement('link'); canonical.rel='canonical'; document.head.append(canonical); }
    canonical.href=origin+route;
    const schema=document.createElement('script'); schema.type='application/ld+json';
    schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:heading,url:origin+route,description}).replace(/</g,'\\u003c');
    document.head.append(schema);
    const file=path.join('dist',route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    await mkdir(path.dirname(file),{recursive:true}); await writeFile(file,dom.serialize());
    dom.window.close();
  }
  const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route=>`\n<url><loc>${origin}${route}</loc></url>`).join('')}\n</urlset>\n`;
  await writeFile('public/sitemap.xml',sitemap); await writeFile('dist/sitemap.xml',sitemap);
  console.log(`Prerender: ${routes.length} public pages.`);
} finally { await server.close(); }
