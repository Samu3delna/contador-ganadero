import { useEffect } from 'react';
import { DEFAULT_OG_IMAGE, SITE_ORIGIN } from '../config/seoCatalog';

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

    const cleanPath = path || window.location.pathname;
    const canonicalUrl = `${SITE_ORIGIN}${cleanPath}`;
    upsertCanonical(canonicalUrl);

    if (title) upsertMeta('property', 'og:title', title);
    if (description) upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', image ? `${SITE_ORIGIN}${image}` : DEFAULT_OG_IMAGE);

    if (jsonLd) {
      upsertJsonLd('seo-jsonld', jsonLd);
    }
    return () => {
      limpiarJsonLd('seo-jsonld');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, image, robots]);
}
