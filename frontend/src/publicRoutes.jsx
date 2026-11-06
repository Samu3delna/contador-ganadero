/* eslint-disable react-refresh/only-export-components -- Route factory shared with static rendering; not a component boundary. */
import { Route } from 'react-router-dom';
import { lazy } from 'react';
const PublicLayout = lazy(() => import('./components/public/PublicLayout'));
const Landing = lazy(() => import('./pages/LandingPage'));
const Product = lazy(() => import('./pages/public/ProductPages'));
const Commercial = lazy(() => import('./pages/public/CommercialPages'));

export function publicRoutes() {
  return <Route element={<PublicLayout />}>
    <Route path="/" element={<Landing />} />
    <Route path="/producto" element={<Product />} />
    <Route path="/producto/:feature" element={<Product />} />
    {['/precios', '/preguntas-frecuentes', '/contacto', '/soluciones'].map(path => <Route key={path} path={path} element={<Commercial />} />)}
    <Route path="*" element={<Commercial />} />
  </Route>;
}
