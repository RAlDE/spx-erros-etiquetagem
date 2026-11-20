'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const BG = fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/manifest.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../catalog.json')));

function setup({fail = '', tamper = false, allowScripts = true} = {}) {
  const messages = {};
  const state = {};
  const scripts = new Map();
  const events = {installed: null, startup: null};
  const calls = [];
  const allJS = ['__spxErrosEtiquetagemCore','__spxErrosEtiquetagemAudit','__spxErrosEtiquetagemApp'].map(sig => `/*${sig}*/\n` + 'x'.repeat(300));
  let tab = {id: 55, url: 'https://spx.shopee.com.br/#/mercadao/audit-list'};
  const chrome = {
    userScripts: allowScripts ? {
      getScripts: async opts => [...scripts.values()].filter(s => !opts?.ids || opts.ids.includes(s.id)),
      unregister: async opts => {calls.push('unregister'); for (const id of opts.ids) scripts.delete(id);},
      register: async list => {calls.push('register'); for (const s of list) scripts.set(s.id,s);},
      execute: async injection => {calls.push('execute');return [{frameId:0,result:{opened:true}}];}
    } : undefined,
    tabs: {query: async()=>[tab]},
    storage:{local:{
      get: async (defaults)=> ({...defaults,...state}),
      set: async (update)=>{Object.assign(state,update);}
    }},
    runtime:{
      onMessage:{addListener:(fn)=>{messages.onMessage=fn;}},
      onInstalled:{addListener:(fn)=>{events.installed=fn;}},
      onStartup:{addListener:(fn)=>{events.startup=fn;}}
    }
  };
  const fetchMock = async url => {
    const str = String(url);
    calls.push('fetch:' + str.split('?')[0].split('/').pop());
    if (fail && str.includes(fail)) return {ok:false,status:404};
    if (str.includes('catalog.json')) return {ok:true,json: async()=> tamper ? {...catalog,modules:[{...catalog.modules[0],scripts:[...catalog.modules[0].scripts.slice(0,2),'https://bad.example.org/page.js']}]} : catalog};
    const index = ['core.js','audit.js','page.js'].findIndex(file=>str.includes('/'+file+'?'));
    if (index < 0) throw Error('Unexpected URL '+str);
    return {ok:true,text:async()=>allJS[index]};
  };
  vm.runInNewContext(BG,{chrome,fetch:fetchMock,Date,console,Promise});
  async function send(type,extra={}) {
    return new Promise((resolve,reject)=> {
      const timeout=setTimeout(()=>reject(new Error('no response '+type)),500);
      const result=messages.onMessage({type,...extra},null,r=>{clearTimeout(timeout);resolve(r)});
      if (result !== true){clearTimeout(timeout);reject(new Error('no handler '+type));}
    });
  }
  return {send, calls, scripts, state, setTab(value){tab=value}, events};
}

test('manifest configura carregador público e userScripts',()=>{
  assert.equal(manifest.version,'0.2.0');
  for(const p of ['userScripts','storage','tabs']) assert.ok(manifest.permissions.includes(p));
  assert.equal(manifest.action.default_popup,'popup.html');
  assert.equal(manifest.background.service_worker,'background.js');
  assert.equal(manifest.minimum_chrome_version,'138');
});
test('catálogo mantém os três módulos na ordem correta e versão 0.1.3',()=>{
  assert.deepEqual(catalog.modules[0].scripts.map(x=>x.split('/').pop()),['core.js','audit.js','page.js']);
  assert.equal(catalog.modules[0].version,'0.1.3');
});
test('SYNC faz download, registra no MAIN e guarda fontes para abrir aba existente',async()=>{
  const x=setup();const r=await x.send('SYNC');
  assert.equal(r.ok,true);
  assert.equal(r.version,'0.1.3');
  const s=x.scripts.get('spx-etq:ranking');
  assert.equal(s.world,'MAIN');assert.equal(s.js.length,3);
  assert.equal(x.state['etq-loader:enabled'],true);
  assert.equal(x.state['etq-loader:module-source'].length,3);
  assert.ok(x.state['etq-loader:last-sync']>0);
});
test('abrir painel injeta código já baixado na página SPX sem navegador recarregar',async()=>{
  const x=setup();await x.send('SYNC');
  const r=await x.send('OPEN_PANEL');assert.equal(r.ok,true);assert.ok(x.calls.includes('execute'));
});
test('aba fora do SPX não recebe scripts',async()=>{
  const x=setup();await x.send('SYNC');x.setTab({id:55,url:'https://github.com'});
  const r=await x.send('OPEN_PANEL');assert.equal(r.ok,false);assert.match(r.error,/SPX/);
  assert.equal(x.calls.includes('execute'),false);
});
test('repositório privado/HTTP 404 impede sincronizar sem desinstalar código anterior',async()=>{
  const x=setup();await x.send('SYNC');
  const old = x.scripts.get('spx-etq:ranking');
  const y=setup({fail:'catalog.json'});
  const response=await y.send('SYNC');assert.equal(response.ok,false);assert.match(response.error,/público/);
  assert.equal(y.calls.includes('unregister'),false);
  assert.ok(old);
});
test('catálogo adulterado é rejeitado antes de registrar qualquer script',async()=>{
  const x=setup({tamper:true});const r=await x.send('SYNC');
  assert.equal(r.ok,false);assert.equal(x.calls.includes('register'),false);
  assert.match(r.error,/autorizados/);
});
test('desativar e reativar mantém estado e registra novamente',async()=>{
  const x=setup();await x.send('SYNC');
  const d=await x.send('TOGGLE_ENABLED',{enabled:false});assert.equal(d.ok,true);
  assert.equal(x.state['etq-loader:enabled'],false);assert.equal(x.scripts.size,0);
  const e=await x.send('TOGGLE_ENABLED',{enabled:true});assert.equal(e.ok,true);
  assert.equal(x.scripts.size,1);
});
test('sem permissão userScripts: erro instrutivo e não faz download',async()=>{
  const x=setup({allowScripts:false});const r=await x.send('SYNC');
  assert.equal(r.ok,false);assert.match(r.error,/Permitir scripts do usuário/);
  assert.equal(x.calls.filter(v=>v.startsWith('fetch:')).length,0);
});
test('STATUS retorna versão do módulo e registro',async()=>{
  const x=setup();await x.send('SYNC');const s=await x.send('STATUS');
  assert.equal(s.ok,true);assert.equal(s.registered,true);assert.equal(s.version,'0.1.3');
});
