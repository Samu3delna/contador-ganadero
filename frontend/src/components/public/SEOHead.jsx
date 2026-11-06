import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resolvePageSeo } from '../../config/seoCatalog';

export default function SEOHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    const update = () => {
      const seo = resolvePageSeo(pathname, document);
      document.title = seo.title;
      const meta = (key, value, property = false) => {
        const attr = property ? 'property' : 'name';
        let node = document.head.querySelector(`meta[${attr}="${key}"]`);
        if (!node) {
          node = document.createElement('meta');
          node.setAttribute(attr, key);
          document.head.append(node);
        }
        node.content = value;
      };
      meta('description', seo.description);
      meta('keywords', seo.keywords);
      meta('robots', seo.isPublic ? 'index, follow' : 'noindex, follow');
      meta('og:site_name', 'ContadorGanadero', true);
      meta('og:title', seo.title, true);
      meta('og:description', seo.description, true);
      meta('og:url', seo.canonical, true);
      meta('og:type', seo.ogType, true);
      meta('og:image', seo.image, true);
      meta('og:image:alt', 'Logo oficial de ContadorGanadero — Contador ganadero y contabilidad ganadera en Costa Rica', true);
      meta('twitter:card', 'summary_large_image');
      meta('twitter:title', seo.title);
      meta('twitter:description', seo.description);
      meta('twitter:image', seo.image);
      let canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.append(canonical);
      }
      canonical.href = seo.canonical;
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
