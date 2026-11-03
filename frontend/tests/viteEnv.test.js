import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadEnv } from 'vite';
import config from '../vite.config.js';

test('S-09: envDir apunta a raiz y Vite expone exclusivamente VITE_ por defecto',()=>{
  assert.equal(path.resolve(import.meta.dirname,'..',config.envDir),path.resolve(import.meta.dirname,'../..'));
  assert.equal(config.envPrefix,undefined);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cgr-public-env-'));
  try {
    fs.writeFileSync(path.join(dir,'.env'),'VITE_REMEDIACION_PUBLIC=synthetic\nREMEDIACION_PRIVATE=synthetic-private\n');
    const values=loadEnv('test',dir);
    assert.equal(values.VITE_REMEDIACION_PUBLIC,'synthetic');
    assert.equal(values.REMEDIACION_PRIVATE,undefined);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
