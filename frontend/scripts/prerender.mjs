import { createServer } from 'vite';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';

const origin = 'https://contadorganadero.com';
const routes = ['/', '/producto', ...['dashboard','facturas','ingresos','gastos','inventario','costos','impuestos'].map(s => `/producto/${s}`), '/precios', '/preguntas-frecuentes', '/contacto', '/soluciones'];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { render } = await server.ssrLoadModule('/src/entry-public.jsx');
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
    const heading = document.querySelector('h1')?.textContent;
    if (!heading) throw new Error(`No H1: ${route}`);
    document.title = `${heading} | ContadorGanadero`;
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
