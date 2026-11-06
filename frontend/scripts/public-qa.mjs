import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:4173');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Only localhost QA is allowed.');
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(path.resolve(modulePath)).href : 'playwright');
const output = path.resolve(process.env.QA_OUTPUT_DIR || 'docs/landing-redesign/qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || 'msedge' });
const report = { startedAt: new Date().toISOString(), browser: browser.version(), widths: [320, 375, 768, 1024, 1440], results: [], failures: [], limitations: ['External network requests blocked; synthetic unauthenticated API. No live account, payment or production writes.', 'Not a Lighthouse or complete WCAG audit.'] };
async function check(name, run) {
  try { await run(); report.results.push({ name, passed: true }); }
  catch (error) { report.results.push({ name, passed: false, error: error.message }); report.failures.push(name); }
}
try {
  const xml = await (await fetch(new URL('/sitemap.xml', base))).text();
  const routes = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname))];
  assert.ok(routes.length); report.routes = routes;
  for (const width of report.widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      if (url.origin !== base.origin) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    let errors = [], ads = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/googlesyndication|doubleclick|adsbygoogle/.test(r.url())) ads.push(r.url()); });
    for (const route of process.env.QA_INTERACTIONS_ONLY === 'true' ? [] : routes) {
      errors = []; ads = [];
      await check(`${width}px ${route}`, async () => {
        const response = await page.goto(new URL(route, base).href, { waitUntil: 'networkidle', timeout: 20000 });
        assert.equal(response.status(), 200);
        await page.locator('h1').waitFor({ timeout: 8000 });
        assert.equal(await page.locator('h1').count(), 1);
        assert.doesNotMatch(await page.locator('h1').innerText(), /404|no encontrad/i);
        const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        assert.ok(layout.content <= layout.width + 1, `overflow ${layout.content} > ${layout.width}`);
        assert.deepEqual(errors, []); assert.deepEqual(ads, []);
        assert.equal(await page.locator('script[src*="adsbygoogle"], ins.adsbygoogle').count(), 0);
        assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
      });
      if (route === '/' || report.failures.at(-1) === `${width}px ${route}`) await page.screenshot({ path: path.join(output, `${width}-${route.replace(/[^a-z0-9]/gi, '-') || 'home'}.png`), fullPage: true });
    }
    await check(`${width}px navigation and demo`, async () => {
      await page.goto(base.href, { waitUntil: 'networkidle' });
      const menu = page.getByRole('button', { name: 'Abrir navegación' });
      if (await menu.isVisible()) {
        await menu.click(); await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false'); await menu.click();
      }
      await page.locator('.cg-product-menu summary').focus(); await page.keyboard.press('Enter');
      await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Dashboard financiero', exact: true }).click();
      await page.waitForURL('**/producto/dashboard');
      await page.getByRole('heading', { level: 1, name: 'Una mirada completa a los números de tu finca.' }).waitFor({ state: 'visible' });
      const demo = page.getByRole('region', { name: 'Demostración del dashboard con datos de ejemplo' });
      await demo.getByRole('combobox').selectOption('0');
      await demo.getByRole('button', { name: 'Gastos', exact: true }).click();
      assert.equal(await demo.getByRole('button', { name: 'Gastos', exact: true }).getAttribute('aria-pressed'), 'true');
      await demo.locator('summary').click();
      await page.waitForFunction(() => document.querySelectorAll('.cg-demo tbody tr').length === 1);
      assert.equal(await demo.locator('tbody tr').count(), 1);
    });
    for (const route of ['/pagina-inexistente-qa', '/producto/toString', '/producto/__proto__']) {
      await check(`${width}px unknown ${route} is noindex`, async () => {
        errors = [];
        await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
        assert.match(await page.locator('h1').innerText(), /no encontra|no existe|404/i);
        assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
        assert.deepEqual(errors, []);
      });
    }
    await context.close();
  }
} catch (error) { report.failures.push('setup'); report.setupError = error.stack; }
finally {
  await browser.close(); report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.results.length, failures: report.failures, output }, null, 2));
  process.exitCode = report.failures.length ? 1 : 0;
}
