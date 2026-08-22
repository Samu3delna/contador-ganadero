import { useEffect } from 'react';

/**
 * Hook ligero de SEO para SPA (sin dependencias externas).
 *
 * Actualiza dinámicamente:
 *  - <title> (meta-título, distinto del H1)
 *  - meta description
 *  - canonical (URL absoluta limpia)
 *  - Open Graph (og:title, og:description, og:url)
 *  - robots (index/noindex)
 *  - JSON-LD (opcional)
 *
 * Uso:
 *   useSeo({
 *     title: '...',
 *     description: '...',
 *     path: '/',
 *     robots: 'index, follow',
 *     jsonLd: [ {...}, {...} ],
 *   });
 */

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id, payload) {
  if (!payload) return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload);
}

function limpiarJsonLd(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

export default function useSeo({
  title,
  description,
  path,
  image,
  robots = 'index, follow',
  jsonLd = null,
}) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', robots);

    const origin = window.location.origin;
    const cleanPath = path || window.location.pathname;
    upsertCanonical(`${origin}${cleanPath}`);

    // Open Graph
    if (title) upsertMeta('property', 'og:title', title);
    if (description) upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', `${origin}${cleanPath}`);
    if (image) upsertMeta('property', 'og:image', `${origin}${image}`);

    // JSON-LD (se limpia al desmontar para no acumular schema)
    if (jsonLd) {
      upsertJsonLd('seo-jsonld', jsonLd);
    }
    return () => {
      limpiarJsonLd('seo-jsonld');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, image, robots]);
}
