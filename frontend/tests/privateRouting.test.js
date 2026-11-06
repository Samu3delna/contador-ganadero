import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import reactPlugin from '@vitejs/plugin-react';
import React from 'react';
import { AxiosError } from 'axios';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let server, dom, api, testing, App, envDir;
before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) globalThis[name] = dom.window[name];
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  testing = await import('@testing-library/react');
  envDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-routing-env-'));
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), envDir,
    resolve: { alias: { '@': path.resolve(import.meta.dirname, '../src') } },
    plugins: [{ name: 'routing-test-view-stubs', enforce: 'pre', transform(code, id) {
      const normalized = id.replaceAll('\\', '/').split('?')[0];
      if (/\/src\/pages\/.+\.jsx$/.test(normalized)) {
        const label = path.basename(normalized, '.jsx');
        return `import React from 'react'; export default function View(){ return React.createElement('h1',null,${JSON.stringify(label)}); }`;
      }
      if (/\/components\/(layout\/Sidebar|dashboard\/ChatBot)\.jsx$/.test(normalized)) return 'export default function Shell(){ return null; }';
      return code;
    } }, reactPlugin()], server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  api = (await server.ssrLoadModule('/src/services/api.js')).default;
  App = (await server.ssrLoadModule('/src/App.jsx')).default;
});
afterEach(() => testing.cleanup());
after(async () => { await server?.close(); dom?.window.close(); fs.rmSync(envDir, { recursive: true, force: true }); });

async function open(route, user) {
  window.history.replaceState({}, '', route);
  api.defaults.adapter = async config => {
    if (!user) throw new AxiosError('Synthetic unauthenticated session', null, config, null, { status: 401, data: {}, headers: {}, config });
    return { data: config.url === '/auth/refresh' ? { token: 'synthetic-test-token' } : user, status: 200, headers: {}, config };
  };
  return testing.render(React.createElement(App));
}
const producer = { _id: 'test-producer', tenantId: 'test-finca', nombre: 'Productor sintético', email: 'test@example.test', rol: 'usuario' };
test('authenticated /ingresos renders its page and retains its URL', async () => {
  const view = await open('/ingresos', producer);
  await testing.waitFor(() => assert.ok(view.getByRole('heading', { name: 'IngresosPage' })));
  assert.equal(window.location.pathname, '/ingresos');
});
test('anonymous private route redirects to login', async () => {
  const view = await open('/ingresos', null);
  await testing.waitFor(() => assert.ok(view.getByRole('heading', { name: 'LoginPage' })));
  assert.equal(window.location.pathname, '/login');
});
test('ordinary producer cannot enter administration', async () => {
  const view = await open('/admin/usuarios', producer);
  await testing.waitFor(() => assert.ok(view.getByRole('heading', { name: 'DashboardPage' })));
  assert.equal(window.location.pathname, '/dashboard');
});
test('superadministrator can enter administration', async () => {
  const view = await open('/admin/usuarios', { ...producer, esSuperAdmin: true });
  await testing.waitFor(() => assert.ok(view.getByRole('heading', { name: 'AdminUsuariosPage' })));
  assert.equal(window.location.pathname, '/admin/usuarios');
});
