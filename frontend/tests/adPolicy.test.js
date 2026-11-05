import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AD_POLICY, isAdEligible } from '../src/config/adPolicy.js';
import { JSDOM } from 'jsdom';
import { loadAdSense } from '../src/components/ads/adsenseLoader.js';

const policy = { ...AD_POLICY, enabled: true, approved: true, reviewedPaths: ['/academia/guia', '/tutoriales/guia'] };
const context = { pathname: '/academia/guia', authLoading: false, consent: 'granted', contentReady: true, client: AD_POLICY.publisher, slot: '123456789' };
test('production policy is disabled even with complete context', () => {
  assert.equal(isAdEligible(context), false);
  assert.deepEqual(AD_POLICY.reviewedPaths, []);
});
test('release, consent, loading and content gates fail closed', () => {
  assert.equal(isAdEligible(context, policy), true);
  for (const override of [{ enabled: false }, { approved: false }]) assert.equal(isAdEligible(context, { ...policy, ...override }), false);
  for (const override of [{ authLoading: true }, { consent: 'unknown' }, { consent: 'denied' }, { contentReady: false }, { client: 'ca-pub-other' }, { slot: '' }]) assert.equal(isAdEligible({ ...context, ...override }, policy), false);
});
test('Pro, conflicting plans, unknown plans and administrators never qualify', () => {
  for (const user of [{ plan: 'pro' }, { tenant: { plan: 'pro' } }, { plan: 'free', tenant: { plan: 'pro' } }, {}, { plan: 'free', esSuperAdmin: true }]) assert.equal(isAdEligible({ ...context, user }, policy), false);
  assert.equal(isAdEligible({ ...context, user: { plan: 'free' } }, policy), true);
});
test('blocked screens stay blocked even if mistakenly allowlisted', () => {
  for (const pathname of ['/', '/login', '/registro', '/precios', '/planes', '/billing', '/perfil', '/admin', '/dashboard', '/privacidad', '/academia', '/tutoriales', '/404', '/academia/guia/editar']) {
    assert.equal(isAdEligible({ ...context, pathname }, { ...policy, reviewedPaths: [pathname] }), false, pathname);
  }
  assert.equal(isAdEligible({ ...context, pathname: '/academia/no-revisada' }, policy), false);
});
test('static publisher verification matches ads.txt with no global ad script', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ads = readFileSync(new URL('../public/ads.txt', import.meta.url), 'utf8');
  assert.ok(html.includes(`name="google-adsense-account" content="${AD_POLICY.publisher}"`));
  assert.ok(ads.includes(AD_POLICY.publisher.slice(3)));
  assert.equal(html.includes('pagead2.googlesyndication.com'), false);
});
test('loader handles failure, retries once and shares concurrent initialization', async () => {
  const dom = new JSDOM('<html><head></head><body></body></html>');
  const doc = dom.window.document;
  await assert.rejects(loadAdSense('invalid', doc));
  assert.equal(doc.scripts.length, 0);
  const failed = loadAdSense(AD_POLICY.publisher, doc);
  const rejection = assert.rejects(failed);
  doc.scripts[0].dispatchEvent(new dom.window.Event('error'));
  await rejection;
  assert.equal(doc.scripts.length, 0);
  const first = loadAdSense(AD_POLICY.publisher, doc);
  const second = loadAdSense(AD_POLICY.publisher, doc);
  assert.equal(first, second);
  assert.equal(doc.scripts.length, 1);
  doc.scripts[0].dispatchEvent(new dom.window.Event('load'));
  await first;
  await loadAdSense(AD_POLICY.publisher, doc);
  assert.equal(doc.scripts.length, 1);
  dom.window.close();
});
