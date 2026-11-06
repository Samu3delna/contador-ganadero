import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import reactPlugin from '@vitejs/plugin-react';
import React from 'react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AxiosError } from 'axios';

let server, dom, testing, envDir, App, api, sessionUser;
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) globalThis[name] = dom.window[name];
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  testing = await import('@testing-library/react');
  envDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-routing-env-'));
  server = await createServer({
    configFile: false, root: path.resolve(import.meta.dirname, '..'), envDir,
    resolve: { alias: { '@': path.resolve(import.meta.dirname, '../src') } },
    optimizeDeps: { noDiscovery: true },
    plugins: [{
      name: 'routing-test-boundaries', enforce: 'pre',
      load(id) {
        const normalized = id.replaceAll('\\', '/');
        if (normalized.endsWith('/src/publicRoutes.jsx')) return 'export function publicRoutes() { return null; }';
        if (/\/src\/components\/(layout\/Sidebar|dashboard\/ChatBot|public\/SEOHead)\.jsx$/.test(normalized)) return 'export default function Boundary() { return null; }';
        if (/\/src\/pages\/.+\.jsx$/.test(normalized)) {
          const name = path.basename(normalized, '.jsx');
          return `import React from 'react'; export default function Page() { return React.createElement('h1', null, ${JSON.stringify(name)}); }`;
        }
      },
    }, reactPlugin()],
    server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
  });
  api = (await server.ssrLoadModule('/src/services/api.js')).default;
  api.defaults.adapter = async config => {
    if (!sessionUser) throw new AxiosError('No session', null, config, null, { status: 401, data: {}, headers: {}, config });
    return { data: config.url === '/auth/refresh' ? { token: 'synthetic-test-token' } : sessionUser, status: 200, headers: {}, config };
  };
  App = (await server.ssrLoadModule('/src/App.jsx')).default;
});
afterEach(() => testing.cleanup());
after(async () => {
  await server?.close(); dom?.window.close();
  if (envDir) fs.rmSync(envDir, { recursive: true, force: true });
});

async function visit(route, user, expectedPage, expectedRoute) {
  sessionUser = user;
  window.history.replaceState({}, '', route);
  const view = testing.render(React.createElement(App));
  await testing.waitFor(() => assert.equal(view.getByRole('heading').textContent, expectedPage), { timeout: 5000 });
  assert.equal(window.location.pathname, expectedRoute);
}
const producer = { _id: 'synthetic-producer', nombre: 'Productor de prueba', tenantId: 'synthetic-farm', plan: 'free', rol: 'usuario' };

test('authenticated direct /ingresos renders within private Outlet without redirect', async () => {
  await visit('/ingresos', producer, 'IngresosPage', '/ingresos');
});
test('unauthenticated /ingresos redirects to login', async () => {
  await visit('/ingresos', null, 'LoginPage', '/login');
});
test('ordinary producer cannot render admin page', async () => {
  await visit('/admin/usuarios', producer, 'DashboardPage', '/dashboard');
});
test('super admin can render nested admin route', async () => {
  await visit('/admin/usuarios', { ...producer, esSuperAdmin: true }, 'AdminUsuariosPage', '/admin/usuarios');
});
