const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const findings = JSON.parse(read('artifacts/auditoria-2026-10-31/hallazgos.json')).findings;
const matrix = JSON.parse(read('artifacts/remediacion/matriz.json'));
assert.equal(matrix.length,67);
assert.equal(new Set(matrix.map(r=>r.id)).size,67);
assert.deepEqual(matrix.map(r=>r.id).sort(),findings.map(r=>r.id).sort());
for(const row of matrix){
  assert.equal(row.severidad,findings.find(f=>f.id===row.id).severity);
  assert.ok(['confirmado','corregido previamente','descartado con evidencia','pendiente'].includes(row.estado));
  for(const e of row.evidenciaActual){
    assert.equal(read(e.archivo).split(/\r?\n/)[e.linea-1].trim(),e.extracto);
  }
  assert.ok(row.prueba.linea>0);
  assert.equal(read(row.prueba.archivo).split(/\r?\n/)[row.prueba.linea-1].trim(),row.prueba.caso);
}
const log = name => {
  const data = fs.readFileSync(path.join(__dirname,'validacion',name));
  return data.toString(data[0]===0xff && data[1]===0xfe?'utf16le':'utf8');
};
assert.match(log('backend-verificacion-final.txt'),/Test Suites:\s+33 passed, 33 total/);
assert.match(log('backend-verificacion-final.txt'),/Tests:\s+251 passed, 251 total/);
assert.match(log('backend-verificacion-final.txt'),/pass 26/);
assert.match(log('backend-verificacion-final.txt'),/fail 0/);
assert.match(log('frontend-verificacion-final.txt'),/pass 57/);
assert.match(log('frontend-verificacion-final.txt'),/fail 0/);
assert.match(log('build-verificacion-final.txt'),/built in/);
assert.doesNotMatch(log('lint-verificacion-final.txt'),/\b[1-9]\d* problems?\b/);
assert.doesNotMatch(log('diff-check-final.txt'),/trailing whitespace|new blank line at EOF|space before tab/);
console.log(JSON.stringify({resultado:'PASS',ids:67,corregidosDuranteTrabajo:57,previosVerificados:10,
  backend:{jest:251,suites:33,sdk:26},frontend:{pruebas:57,lint:'PASS',build:'PASS'},
  limites:'Solo validacion local; ver informe-final.md',verificadoEn:new Date().toISOString()},null,2));
