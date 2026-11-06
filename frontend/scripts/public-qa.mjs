// Run against a local production preview. No production API requests are permitted.
// PLAYWRIGHT_MODULE may point to an externally installed playwright/index.mjs.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:4173');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  throw new Error('QA_BASE_URL must be localhost: this suite must not exercise production.');
}
const output = path.resolve(process.env.QA_OUTPUT_DIR || path.join(frontendRoot, '../docs/landing-redesign/qa'));
const moduleName = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(path.resolve(moduleName)).href : 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || 'msedge' });
await mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), baseUrl: base.href, browser: browser.version(), widths: [320, 375, 768, 1024, 1440], results: [], failures: [], limitations: ['API responses are mocked as unauthenticated; no live login, registration, payment or private data is tested.', 'External network requests are blocked. This is not a Lighthouse or full WCAG audit.'] };
const checks = async (name, run) => {
  try { await run(); report.results.push({ name, passed: true }); }
  catch (error) { report.results.push({ name, passed: false, error: error.message }); report.failures.push(name); }
};
try {
  const sitemapResponse = await fetch(new URL('/sitemap.xml', base));
  assert.equal(sitemapResponse.status, 200, 'sitemap must respond 200');
  const xml = await sitemapResponse.text();
  const routes = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname))];
  assert.ok(routes.length > 0, 'sitemap must contain pages');
  report.routes = routes;
  for (const width of report.widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"QA unauthenticated"}' });
      if (url.origin !== base.origin) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    let pageErrors = [];
    let adRequests = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => { if (/googlesyndication|doubleclick|adsbygoogle/.test(request.url())) adRequests.push(request.url()); });
    for (const route of routes) {
      pageErrors = []; adRequests = [];
      await checks(`${width}px ${route}`, async () => {
        const response = await page.goto(new URL(route, base).href, { waitUntil: 'networkidle', timeout: 20000 });
        assert.equal(response.status(), 200, 'page must respond 200');
        await page.locator('main h1').waitFor({ state: 'visible', timeout: 10000 });
        assert.equal(await page.locator('h1').count(), 1, 'one H1 expected');
        assert.doesNotMatch(await page.locator('h1').innerText(), /404|no encontrad/i, 'sitemap must not contain error pages');
        const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        assert.ok(overflow.content <= overflow.viewport + 1, `horizontal overflow ${overflow.content} > ${overflow.viewport}`);
        assert.equal(await page.locator('ins.adsbygoogle, iframe[src*="doubleclick"], script[src*="adsbygoogle"]').count(), 0, 'ads must remain disabled');
        assert.deepEqual(adRequests, [], 'no ad network request expected');
        assert.deepEqual(pageErrors, [], 'no uncaught JavaScript errors expected');
        assert.ok(await page.title(), 'title expected');
        assert.equal(await page.locator('link[rel="canonical"]').count(), 1, 'one canonical expected');
      });
      if (route === '/' || report.failures.at(-1) === `${width}px ${route}`) {
        const name = route.replace(/[^a-z0-9]+/gi, '-') || 'home';
        await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true });
      }
    }
    await checks(`${width}px navigation and demo`, async () => {
      await page.goto(base.href, { waitUntil: 'networkidle' });
      const openMenu = page.getByRole('button', { name: 'Abrir navegación' });
      if (await openMenu.isVisible()) {
        await openMenu.click();
        assert.equal(await page.getByRole('button', { name: 'Cerrar navegación' }).getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        assert.equal(await openMenu.getAttribute('aria-expanded'), 'false');
        await openMenu.click();
      }
      const summary = page.locator('.cg-product-menu summary');
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.cg-product-menu').getAttribute('open'), '');
      await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Dashboard financiero', exact: true }).click();
      await page.waitForURL('**/producto/dashboard');
      const demo = page.getByRole('region', { name: 'Demostración del dashboard con datos de ejemplo' });
      await demo.waitFor({ state: 'visible' });
      await demo.getByRole('combobox').selectOption('0');
      assert.equal(await demo.getByRole('combobox').inputValue(), '0');
      await demo.getByRole('button', { name: 'Gastos', exact: true }).click();
      assert.equal(await demo.getByRole('button', { name: 'Gastos', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.match(await demo.locator('[aria-live="polite"]').innerText(), /Compras y gastos/i);
      await demo.locator('summary').click();
      assert.equal(await demo.locator('tbody tr').count(), 1);
    });
    await context.close();
  }
  const errorsContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await errorsContext.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"QA unauthenticated"}' });
    return url.origin === base.origin ? route.continue() : route.abort();
  });
  const errorsPage = await errorsContext.newPage();
  for (const route of ['/tutoriales', '/academia', '/academia/no-existe', '/producto/no-existe', '/login']) {
    await checks(`noindex and no ads ${route}`, async () => {
      await errorsPage.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
      await errorsPage.waitForFunction(() => document.querySelector('meta[name="robots"]')?.content.includes('noindex'));
      assert.equal(await errorsPage.locator('ins.adsbygoogle, script[src*="adsbygoogle"], iframe[src*="doubleclick"]').count(), 0);
      if (route !== '/login') {
        await errorsPage.locator('h1').waitFor({ state: 'visible' });
        assert.match(await errorsPage.locator('h1').innerText(), /404|no encontra|no existe/i);
      }
    });
  }
  await errorsContext.close();
} catch (error) {
  report.failures.push('suite setup'); report.setupError = error.stack;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ checks: report.results.length, failures: report.failures, output }, null, 2));
  process.exitCode = report.failures.length ? 1 : 0;
}
