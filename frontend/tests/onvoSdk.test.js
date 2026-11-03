import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarSdkOnvo } from '../src/services/onvoSdk.js';
test('F-29: SDK con fallo temporal se puede cargar de nuevo y comparte peticiones concurrentes', async () => {
  const scripts = [];
  globalThis.window = {};
  globalThis.document = { createElement: () => ({ remove() { this.removed = true; } }), head: { appendChild: s => scripts.push(s) } };
  try {
    const first = cargarSdkOnvo(); assert.equal(cargarSdkOnvo(), first);
    scripts[0].onerror(); await assert.rejects(first); assert.equal(scripts[0].removed, true);
    const retry = cargarSdkOnvo(); assert.equal(scripts.length, 2);
    window.onvo = { pay() {} }; scripts[1].onload(); await retry;
    await cargarSdkOnvo(); assert.equal(scripts.length, 2);
  } finally { delete globalThis.window; delete globalThis.document; }
});
