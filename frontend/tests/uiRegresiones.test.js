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
let server, dom, api, testing, envDir;
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' });
  for (const name of ['window','document','HTMLElement','Element','Node','MutationObserver']) globalThis[name] = dom.window[name];
  Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  testing = await import('@testing-library/react');
  envDir=fs.mkdtempSync(path.join(os.tmpdir(),'cgr-vite-env-'));
  server=await createServer({configFile:false,root:path.resolve(import.meta.dirname,'..'),envDir,
    resolve:{alias:{'@':path.resolve(import.meta.dirname,'../src')}},
    plugins:[reactPlugin()],server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  api=(await server.ssrLoadModule('/src/services/api.js')).default;
});
afterEach(()=>testing.cleanup());
after(async()=>{await server?.close();dom?.window.close();fs.rmSync(envDir,{recursive:true,force:true});});

test('S-11: formularios de cuatro especies tienen nombres accesibles y labels asociados',async()=>{
  for(const nombre of ['BovinoForm','AvesForm','PecesForm','ColmenaForm']) {
    const Component=(await server.ssrLoadModule(`/src/components/inventario/${nombre}.jsx`)).default;
    const view=testing.render(React.createElement(Component,{onSave(){}}));
    const labels=[...view.container.querySelectorAll('label')];assert.ok(labels.length>0);
    for(const label of labels) { assert.ok(label.htmlFor,`${nombre}: ${label.textContent}`);assert.ok(view.container.querySelector(`[id="${label.htmlFor}"]`)); }
    view.unmount();
  }
});

test('F-25: cambiar periodo oculta resultado anterior y fallo no lo atribuye al periodo nuevo',async()=>{
  const pending=[];
  api.defaults.adapter=config=>new Promise((resolve,reject)=>pending.push({config,resolve,reject}));
  const Component=(await server.ssrLoadModule('/src/pages/ImpuestosPage.jsx')).default;
  const view=testing.render(React.createElement(Component));
  await testing.waitFor(()=>assert.equal(pending.length,1));
  await testing.act(async()=>pending[0].resolve({data:{ivaCobrado:12345,ivaResultante:12345},status:200,statusText:'OK',headers:{},config:pending[0].config}));
  assert.match(view.container.textContent,/12[\s,.]345/);
  const year=view.getAllByRole('combobox')[0];
  testing.fireEvent.change(year,{target:{value:'2025'}});
  await testing.waitFor(()=>assert.equal(pending.length,2));
  assert.doesNotMatch(view.container.textContent,/12[\s,.]345/);
  await testing.act(async()=>pending[1].reject(new Error('fallo sintetico')));
  assert.ok(view.getByRole('alert'));assert.doesNotMatch(view.container.textContent,/12[\s,.]345/);
});

test('F-25: respuesta lenta del periodo anterior no reemplaza el nuevo',async()=>{
  const pending=[];api.defaults.adapter=config=>new Promise(resolve=>pending.push({config,resolve}));
  const Component=(await server.ssrLoadModule('/src/pages/ImpuestosPage.jsx')).default;
  const view=testing.render(React.createElement(Component));await testing.waitFor(()=>assert.equal(pending.length,1));
  testing.fireEvent.change(view.getAllByRole('combobox')[0],{target:{value:'2025'}});
  await testing.waitFor(()=>assert.equal(pending.length,2));
  const reply=(p,value)=>p.resolve({data:{ivaCobrado:value,ivaResultante:value},status:200,statusText:'OK',headers:{},config:p.config});
  await testing.act(async()=>reply(pending[1],54321));
  await testing.act(async()=>reply(pending[0],12345));
  assert.match(view.container.textContent,/54[\s,.]321/);assert.doesNotMatch(view.container.textContent,/12[\s,.]345/);
});

test('F-26: perfil protegido renueva token una vez para peticiones concurrentes y conserva credenciales',async()=>{
  const mod=await server.ssrLoadModule('/src/services/api.js');mod.setAccessToken('expired');let refreshes=0;
  api.defaults.adapter=async config=>{
    if(config.url==='/auth/refresh'){refreshes++;await new Promise(r=>setTimeout(r,15));return {data:{token:'new'},status:200,headers:{},config};}
    if(config.headers.Authorization==='Bearer expired')throw new AxiosError('vencido',null,config,null,{status:401,data:{},headers:{},config});
    return {data:{nombre:'Renovado'},status:200,headers:{},config};
  };
  const results=await Promise.all([mod.refreshTokenAPI(),mod.refreshTokenAPI(),api.get('/auth/perfil'),api.put('/auth/perfil',{nombre:'Renovado'})]);
  assert.equal(refreshes,1);assert.ok(results.every(r=>r.status===200));assert.equal(api.defaults.withCredentials,true);mod.setAccessToken(null);
});

test('S-01: cuenta nueva no carga historial global ni mensajes de la cuenta anterior',async()=>{
  const auth=await server.ssrLoadModule('/src/context/AuthContext.jsx');
  const Chat=(await server.ssrLoadModule('/src/components/dashboard/ChatBot.jsx')).default;
  let session;function Harness(){session=auth.useAuth();return React.createElement(Chat);}
  api.defaults.adapter=async config=>{
    if(config.url==='/auth/refresh')throw new AxiosError('sin sesion',null,config,null,{status:401,data:{},headers:{},config});
    if(config.url==='/auth/login'){const input=JSON.parse(config.data);return {data:{_id:input.email,tenantId:'finca-'+input.email,nombre:input.email,token:'synthetic'},status:200,headers:{},config};}
    return {data:{respuesta:'Respuesta de prueba'},status:200,headers:{},config};
  };
  window.localStorage.setItem('chatbot_mensajes_v1',JSON.stringify([{rol:'usuario',contenido:'secreto-global'}]));
  const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Red externa desactivada');};
  try{
    const view=testing.render(React.createElement(auth.AuthProvider,null,React.createElement(Harness)));
    await testing.waitFor(()=>assert.equal(session.cargando,false));
    await testing.act(async()=>session.login('a@example.test','synthetic'));
    testing.fireEvent.click(view.getByRole('button',{name:'Abrir asistente IA'}));
    assert.doesNotMatch(view.container.textContent,/secreto-global/);
    testing.fireEvent.change(view.getByRole('textbox',{name:'Tu mensaje'}),{target:{value:'dato-privado-cuenta-a'}});
    testing.fireEvent.click(view.getByRole('button',{name:'Enviar'}));
    await testing.waitFor(()=>assert.match(view.container.textContent,/dato-privado-cuenta-a/));
    await testing.act(async()=>session.logout());
    await testing.act(async()=>session.login('b@example.test','synthetic'));
    testing.fireEvent.click(view.getByRole('button',{name:'Abrir asistente IA'}));
    assert.doesNotMatch(view.container.textContent,/dato-privado-cuenta-a|secreto-global/);
  }finally{globalThis.fetch=oldFetch;}
});

test('P-01: emisor se obtiene de sesion React con localStorage.usuario ausente',async()=>{
  const auth=await server.ssrLoadModule('/src/context/AuthContext.jsx');
  const Emitir=(await server.ssrLoadModule('/src/components/hacienda/EmitirComprobanteModal.jsx')).default;
  let session;function Harness(){session=auth.useAuth();return session.usuario ? React.createElement(Emitir,{isOpen:true,onClose(){},onSave(){},tipoDoc:'FE'}) : null;}
  api.defaults.adapter=async config=>{
    if(config.url==='/auth/refresh')throw new AxiosError('sin sesion',null,config,null,{status:401,data:{},headers:{},config});
    return {data:{_id:'owner',tenantId:'finca',nombre:'Productor de prueba',cedula:{tipo:'fisica',numero:'123456789'},token:'synthetic'},status:200,headers:{},config};
  };
  const view=testing.render(React.createElement(auth.AuthProvider,null,React.createElement(Harness)));
  await testing.waitFor(()=>assert.equal(session.cargando,false));
  await testing.act(async()=>session.login('owner@example.test','synthetic'));
  await testing.waitFor(()=>assert.equal(view.getAllByLabelText('Nombre *')[0].value,'Productor de prueba'));
  assert.equal(view.getAllByLabelText('Identificación *')[0].value,'123456789');assert.equal(window.localStorage.getItem('usuario'),null);
});

test('F-28: refrescar con fallo muestra error sin anunciar exito',async()=>{
  const {toast}=await import('react-hot-toast');const oldSuccess=toast.success,oldError=toast.error;const successes=[],errors=[];
  toast.success=message=>successes.push(message);toast.error=message=>errors.push(message);
  let fail=false;
  api.defaults.adapter=async config=>{
    if(config.url==='/facturas' && fail)throw new Error('fallo sintetico');
    return {data:config.url==='/facturas'?{facturas:[],total:0,totalPaginas:0}:config.url==='/facturas/alertas-tarifa'?{totalAlertas:0,alertas:[]}:{},status:200,headers:{},config};
  };
  try {
    const Component=(await server.ssrLoadModule('/src/pages/FacturasPage.jsx')).default;
    const auth=await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const view=testing.render(React.createElement(auth.AuthProvider,null,React.createElement(Component)));
    await testing.waitFor(()=>assert.ok(view.getByRole('button',{name:'Refrescar'})));
    fail=true;testing.fireEvent.click(view.getByRole('button',{name:'Refrescar'}));
    await testing.waitFor(()=>assert.ok(view.getByRole('alert')));
    assert.equal(successes.length,0);assert.ok(errors.length>0);
  }finally{toast.success=oldSuccess;toast.error=oldError;}
});

test('P-07: estado confirmado del plan actualiza AuthContext sin perder la finca',async()=>{
  const auth=await server.ssrLoadModule('/src/context/AuthContext.jsx');
  const Planes=(await server.ssrLoadModule('/src/pages/PlanesPage.jsx')).default;
  let session;
  function Harness(){session=auth.useAuth();return session.usuario?React.createElement(Planes):null;}
  api.defaults.adapter=async config=>({data:config.url==='/auth/refresh'?{token:'synthetic'}:
    config.url==='/auth/perfil'?{_id:'owner',tenant:{_id:'finca',plan:'free',nombreFinca:'Conservada'},plan:'free'}:
    config.url==='/onvo/estado'?{tenant:{_id:'finca',plan:'pro'}}:{},status:200,headers:{},config});
  testing.render(React.createElement(auth.AuthProvider,null,React.createElement(Harness)));
  await testing.waitFor(()=>assert.equal(session.usuario?.plan,'pro'));
  assert.equal(session.usuario.tenant.plan,'pro');assert.equal(session.usuario.tenant.nombreFinca,'Conservada');
});

test('L-01: LoginPage normaliza registro (cedula/telefono), maneja errores y RecuperarCuentaPage procesa enlaces',async()=>{
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const auth = await server.ssrLoadModule('/src/context/AuthContext.jsx');
  const LoginPage = (await server.ssrLoadModule('/src/pages/LoginPage.jsx')).default;
  const RecuperarCuentaPage = (await server.ssrLoadModule('/src/pages/RecuperarCuentaPage.jsx')).default;
  let capturedBody = null;
  api.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') throw new AxiosError('sin sesion', null, config, null, { status: 401, data: {}, headers: {}, config });
    if (config.url === '/auth/registro') {
      capturedBody = JSON.parse(config.data);
      return {
        data: { _id: 'u1', tenantId: 't1', nombre: capturedBody.nombre, email: capturedBody.email, plan: 'free', token: 'jwt-reg' },
        status: 201,
        headers: {},
        config,
      };
    }
    if (config.url === '/auth/forgot-password') {
      return { data: { mensaje: 'Si el correo está registrado, recibirás instrucciones.' }, status: 200, headers: {}, config };
    }
    return { data: {}, status: 200, headers: {}, config };
  };

  const view = testing.render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/registro'] },
      React.createElement(
        auth.AuthProvider,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/registro', element: React.createElement(LoginPage) }),
          React.createElement(Route, { path: '/dashboard', element: React.createElement('div', null, 'Panel Finca') }),
        ),
      ),
    ),
  );

  await testing.waitFor(() => assert.ok(view.getByLabelText('Nombre completo')));
  testing.fireEvent.change(view.getByLabelText('Nombre completo'), { target: { name: 'nombre', value: '  Productor REA  ' } });
  testing.fireEvent.change(view.getByLabelText(/Cédula física o jurídica/), { target: { name: 'cedula', value: '1-0999-0888' } });
  testing.fireEvent.change(view.getByLabelText(/Celular/), { target: { name: 'telefono', value: '8888-7777' } });
  testing.fireEvent.change(view.getByLabelText('Correo electrónico'), { target: { name: 'email', value: 'Productor@Finca.CR' } });
  testing.fireEvent.change(view.getByLabelText('Contraseña'), { target: { name: 'password', value: 'ClaveSegura2026!' } });
  testing.fireEvent.click(view.getByRole('checkbox'));
  testing.fireEvent.click(view.getByRole('button', { name: /Crear Cuenta/i }));

  await testing.waitFor(() => assert.ok(capturedBody));
  assert.equal(capturedBody.nombre, 'Productor REA');
  assert.equal(capturedBody.email, 'productor@finca.cr');
  assert.equal(capturedBody.cedula, '109990888');
  assert.equal(capturedBody.telefono, '+50688887777');
  assert.equal(capturedBody.aceptaTerminos, true);
  view.unmount();

  const recView = testing.render(
    React.createElement(MemoryRouter, { initialEntries: ['/recuperar-password'] }, React.createElement(RecuperarCuentaPage)),
  );
  testing.fireEvent.change(recView.getByLabelText('Correo registrado'), { target: { value: 'productor@finca.cr' } });
  testing.fireEvent.click(recView.getByRole('button', { name: 'Solicitar enlace' }));
  await testing.waitFor(() => assert.ok(recView.getByRole('status')));
  assert.match(recView.getByRole('status').textContent, /instrucciones/i);
  recView.unmount();
});
