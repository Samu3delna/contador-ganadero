import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
// Existing Playwright installation can be reused; no project dependency is required.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true });
const base = process.env.DASHBOARD_QA_URL || 'http://localhost:4173';
const out = new URL('../../docs/dashboard-review/', import.meta.url);
await mkdir(out, { recursive: true });
const admin = { usuarios: { total: 128, suspendidos: 3, nuevos30d: 12, registrosPorDia: [{fecha:'2026-11-01',total:3},{fecha:'2026-11-02',total:7},{fecha:'2026-11-03',total:2}] }, tenants: {total:98,porPlan:{free:80,pro:18},porEstado:{activo:92,suspendido:3,periodo_gracia:3}}, actividad:{facturasTotal:1240,facturas30d:180,ingresosRegistrados:230}, suscripciones:{mrrEstimadoUSD:180,proActivos:18,eventosOnvo24h:9,eventosOnvoConError:2},chatFeedback:{positivo:45,negativo:3} };
const producer = {periodoFiscal:2025,cuatrimestreActual:3,resumen:{totalIngresos:4800000,totalGastos:1850000,utilidadNeta:2950000,ivaAPagar:48000,ivaCredito:0,rentaAPagar:0},ivaProyectado:{totalFacturas:18},rentaProyectada:{impuestoFinal:0}};
const results = [];
async function setup(role, state = {mode:'success'}) {
 const context = await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
 const page = await context.newPage();
 const errors=[]; page.on('pageerror',error=>{ errors.push(error.message); console.error(error.stack); });
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  let data={};
  if(url.pathname.endsWith('/auth/refresh')) data={token:'qa-test-only'};
  else if(url.pathname.endsWith('/auth/perfil')) data={_id:'qa',nombre:'Finca de revisión',nombreFinca:'La Esperanza',rol:role==='admin'?'superadmin':'usuario',esSuperAdmin:role==='admin',plan:'pro'};
  else if(url.pathname.endsWith('/admin/resumen') || url.pathname.endsWith('/dashboard/resumen')) {
   await new Promise(resolve=>setTimeout(resolve,state.mode==='loading'?1200:100));
   if(state.mode==='error') return route.fulfill({status:503,json:{error:'Servicio temporalmente no disponible'}});
   data=url.pathname.endsWith('/admin/resumen')?structuredClone(admin):structuredClone(producer);
   if(state.mode==='empty') { if(role==='admin') {data.usuarios.registrosPorDia=[];data.tenants.porPlan={};data.tenants.porEstado={};} else {data.resumen.totalIngresos=0;data.resumen.totalGastos=0;data.ivaProyectado.totalFacturas=0;} }
  } else if(url.pathname.endsWith('/dashboard/tendencia-mensual')) {
   assert.equal(url.searchParams.get('anio'),'2025');
   data=state.mode==='empty'?[]:[{mes:'Ene',ingresos:1200000,gastos:400000},{mes:'Feb',ingresos:1800000,gastos:700000},{mes:'Mar',ingresos:1800000,gastos:750000}];
  } else if(url.pathname.endsWith('/dashboard/gastos-por-categoria')) data=state.mode==='empty'?[]:[{categoria:'alimentos',cantidad:12,totalGasto:1200000},{categoria:'veterinaria',cantidad:6,totalGasto:650000}];
  return route.fulfill({json:data});
 });
 return {context,page,errors};
}
try {
 for(const role of ['admin','producer']) {
  const state={mode:'loading'}; const {context,page,errors}=await setup(role,state);
  const route=role==='admin'?'/admin':'/dashboard';
  await page.goto(base+route);
  await page.locator('.ds-header').waitFor();
  assert.equal(await page.locator('[aria-busy="true"]').count()>0,true);
  await page.screenshot({path:new URL(`${role}-loading.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1')});
  state.mode='success'; await page.locator('h1').waitFor();
  for(const theme of ['light','dark']) {
   await page.evaluate(theme=>{localStorage.setItem('cg-theme',theme);window.dispatchEvent(new Event('storage'));},theme);
   await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
   for(const width of [320,375,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${role} ${theme} ${width}: horizontal overflow`);
    await page.screenshot({path:new URL(`${role}-${theme}-${width}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
   }
  }
  await page.getByRole('button',{name:'Activar modo claro'}).filter({visible:true}).first().click();
  await page.reload(); await page.locator('h1').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  state.mode='error'; await page.getByRole('button',{name:'Actualizar',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.ok(await page.locator(role==='admin'?'.admin-overview-kpis':'.producer-metrics').isVisible(),'Refresh retains content');
  state.mode='success'; await page.getByRole('button',{name:'Reintentar'}).click();
  await page.getByRole('alert').waitFor({state:'hidden'});
  await page.goto(base+(role==='admin'?'/dashboard':'/admin'));
  await page.waitForURL(base+route);
  if(role==='producer') assert.equal(await page.locator('a[href="/admin"]').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:375,height:900});
  await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button',{name:'Abrir menú',exact:true}).getAttribute('aria-expanded'),'false');
  assert.equal(await page.getByRole('button',{name:'Abrir menú',exact:true}).evaluate(el=>el===document.activeElement),true,'Escape restores focus');
  await page.evaluate(()=>localStorage.removeItem('cg-theme'));
  await page.emulateMedia({colorScheme:'dark'});
  await page.reload(); await page.locator('h1').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','System preference on first load');
  await page.emulateMedia({colorScheme:'light'});
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  assert.equal(await page.locator('.topbar img').evaluate(el=>el.complete && el.naturalWidth>0),true,'Official logo loaded');
  await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.sidebar').contains(document.activeElement));
  await page.locator('.sidebar').evaluate(el=>{const items=[...el.querySelectorAll('a,button')].filter(e=>e.getClientRects().length);items.at(-1).focus();});
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.sidebar').evaluate(el=>el.contains(document.activeElement)),true,'Tab remains within drawer');
  assert.ok(await page.locator('.sidebar').evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)<0.001),'Reduced motion disables visible drawer transition');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  results.push({role,passed:['loading skeleton','5 widths x 2 themes','theme persistence','refresh error retains data','retry','role redirect','mobile Escape and focus restore','system theme and live changes','official mobile logo'],pageErrors:errors});
  await context.close();
  const initial = await setup(role,{mode:'error'});
  await initial.page.goto(base+route);
  await initial.page.getByRole('alert').waitFor();
  assert.equal(await initial.page.locator('.ds-header').count(),0,'Initial error removes skeleton');
  assert.equal(await initial.page.locator(role==='admin'?'.admin-overview-kpis':'.producer-metrics').count(),0,'Initial errors are not zero metrics');
  await initial.context.close();
  const empty=await setup(role,{mode:'empty'});
  await empty.page.goto(base+route);
  await empty.page.locator(role==='admin'?'.admin-chart-empty':'.producer-empty').first().waitFor();
  await empty.context.close();
 }
 await writeFile(new URL('qa-results.json',out),JSON.stringify({note:'Network fixtures only. No production requests or data mutations.',results},null,2));
 console.log(JSON.stringify(results));
} finally { await browser.close(); }
