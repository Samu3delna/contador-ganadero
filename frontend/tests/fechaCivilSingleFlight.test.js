import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoyCivil, mostrarFechaCivil } from '../src/utils/fechaCivil.js';
import { singleFlight } from '../src/utils/singleFlight.js';
test('F-27: fecha civil de Costa Rica no avanza por UTC ni retrocede al mostrarse',()=>{
  assert.equal(hoyCivil(new Date('2026-11-01T01:00:00Z')),'2026-10-31');
  assert.equal(mostrarFechaCivil('2026-10-31T00:00:00Z'),'31/10/2026');
});
test('S-10: dos envios simultaneos ejecutan una operacion y permiten otro tras terminar',async()=>{
  const once=singleFlight();let calls=0,finish;
  const action=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const a=once(action),b=once(action);assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);
  finish();await a;await once(()=>{calls++;});assert.equal(calls,2);
});
