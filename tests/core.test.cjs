const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/core.js');
const evt = (status, time, operator='', message='') => ({status, ctime: time, operator, message});
const tracking = entries => ({data:{tracking_list:[{children:entries}]}});

test('cola BRs misturados; elimina repetidos e não aceita SPXBR embutido',()=>{
  assert.deepEqual(C.parseBrs('erro BR123456789012A,BR123456789012A\nSPXBR123456789012C ; BR999999999999Z'),['BR123456789012A','BR999999999999Z']);
});

test('seleciona último recebimento, e não último evento ou primeiro recebimento',()=>{
  const t=tracking([evt('LMHub_Recebido',1794000000,'[Ops100] ANTIGO'),evt('LMHub_Recebido',1794100000,'[Ops200] NOVO'),evt('LMHub_Atribuindo',1794100001,'Admin','Pedido em processamento na Assignment Task [AT20261113CNHVJ]')]);
  const r=C.summarizeTracking(t);
  assert.equal(r.ok,true);assert.equal(r.ops,'Ops200');assert.equal(r.name,'NOVO');assert.equal(r.assignmentId,'AT20261113CNHVJ');
});

test('OPs ausente no último recebimento não herda operador antigo',()=>{
  const r=C.summarizeTracking(tracking([evt('LMHub_Recebido',1794000000,'[Ops100] ANTIGO'),evt('LMHub_Recebido',1794100000,'Admin')]));
  assert.equal(r.ok,false);assert.equal(r.reason,'ops_nao_identificado');
});

test('evita atribuição de AT anterior ao recebimento',()=>{
  const t=tracking([evt('LMHub_Atribuindo',1794000000,'','Assignment Task [AT20261111VELHA]'),evt('LMHub_Recebido',1794100000,'[Ops22] ANA')]);
  assert.equal(C.summarizeTracking(t).assignmentId,'');
});

test('não atribui quando recebe status numérico sem LMHub_Recebido textual',()=>{
  const r=C.summarizeTracking({data:{tracking_list:[{status:126,ctime:1794100000,operator:'[Ops22] ANA'}]}});
  assert.equal(r.ok,false);assert.equal(r.reason,'recebimento_nao_identificado');
});

test('classifica situações com timestamps sem ordem original',()=>{
  const r=C.summarizeTracking(tracking([evt('LMHub_Recebido',1794100000,'[Ops22] RECENTE'),evt('LMHub_Recebido',1794000000,'[Ops33] ANTIGO')]));
  assert.equal(r.ops,'Ops22');
});

test('não resolve conflito de OPSs no mesmo timestamp por chute',()=>{
  const r=C.summarizeTracking(tracking([evt('LMHub_Recebido',1794100000,'[Ops22] A'),evt('LMHub_Recebido',1794100000,'[Ops33] B')]));
  assert.equal(r.ok,false);assert.equal(r.reason,'operadores_conflitantes_mesmo_horario');
});

test('AT deve ter ID exato e rua em coluna semanticamente correta',()=>{
  const r=C.extractLane({data:{list:[{assignment_task_id:'AT20261113CNHVJ',corridor_cage_route:'B-34',driver_name:'João'}]}},'AT20261113CNHVJ');
  assert.deepEqual(r,{ok:true,lane:'B-34'});
  const bad=C.extractLane({data:{list:[{assignment_task_id:'AT20261113OUTRA',corridor_cage_route:'B-34'}]}},'AT20261113CNHVJ');
  assert.equal(bad.ok,false);
});

test('ranking agrupa pelo ID do OPS e BRs, ordena por erros; mantém desconhecidos fora',()=>{
  const b=C.buildRanking([{ok:true,br:'BR1',ops:'Ops22',name:'ANA',receivedAt:1},{ok:true,br:'BR2',ops:'Ops33',name:'BIA',receivedAt:2},{ok:true,br:'BR3',ops:'Ops22',name:'ANA',receivedAt:3},{ok:false,br:'BR4',reason:'ops_nao_identificado'}]);
  assert.equal(b.ranking[0].ops,'Ops22');assert.equal(b.ranking[0].count,2);assert.equal(b.counted,3);assert.equal(b.unknown.length,1);
});

test('recognizes accented labels and OPS',()=>{
  const r=C.summarizeTracking(tracking([{status:'LMHub Recebído',timestamp:1794100000000,operator:'[OPS131849] GISELI DE PAULA MARTINS'}]));
  assert.equal(r.ops,'Ops131849');
});