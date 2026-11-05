import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

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
export default function SEOHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Wait for lazy route content before deriving article metadata.
    const update = () => {
      const heading = document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
      const isPublic = Boolean(titles[pathname]) || /^\/(academia|tutoriales)\/[^/]+$/.test(pathname);
      const missing = /no encontrad|no existe|404/i.test(heading || '');
      const title = `${titles[pathname] || heading || 'ContadorGanadero'} | ContadorGanadero`;
      document.title = title;
      const description = document.querySelector('main p')?.textContent?.slice(0, 170) || 'Organiza la información financiera y productiva de tu actividad agropecuaria en Costa Rica.';
      const meta = (key, value, property = false) => {
        const attr = property ? 'property' : 'name';
        let node = document.head.querySelector(`meta[${attr}="${key}"]`);
        if (!node) { node = document.createElement('meta'); node.setAttribute(attr, key); document.head.append(node); }
        node.content = value;
      };
      meta('description', description);
      meta('robots', isPublic && !missing ? 'index, follow' : 'noindex, follow');
      meta('og:title', title, true); meta('og:description', description, true);
      meta('og:url', `https://contadorganadero.com${pathname}`, true);
      meta('og:type', pathname.startsWith('/academia/') ? 'article' : 'website', true);
      meta('twitter:card', 'summary'); meta('twitter:title', title); meta('twitter:description', description);
      let canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
      canonical.href = `https://contadorganadero.com${pathname}`;
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
