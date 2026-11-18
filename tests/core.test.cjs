const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../extension/core.js');
const A=require('../extension/audit.js');
const t=(status,ts,operator,extras={})=>({status,timestamp:ts,operator,...extras});
const payload=events=>({retcode:0,data:{tracking_list:[{children:events}]}});

// O motivo real dos 33 BRs foi statusSamples [] com status numérico.
test('status 1 é LMHub_Received normal',()=>assert.equal(C.isReceived(t(1,1794934104,'[Ops22] ANA')),true));
test('status 10 Return não é LMHub_Received normal',()=>assert.equal(C.isReceived(t(10,1794934104,'[Ops22] ANA')),false));
test('mensagem de chegada LMHub com status numérico é reconhecida',()=>assert.equal(C.isReceived(t(991,1794934104,'[Ops22] ANA',{message:'Pedido chegou ao Last Mile Hub para entrega'})),true));
test('não confunde mensagem solta de retorno com normal',()=>assert.equal(C.isReceived(t(10,1794934104,'[Ops22] ANA',{message:'Pedido chegou ao Last Mile Hub para entrega'})),false));
test('não reconhece atribuição como recebimento',()=>assert.equal(C.isReceived(t(2,1794934104,'Admin',{message:'Pedido em processamento na Assignment Task [AT20261113CNHVJ]'})),false));
test('recebimento de outro hub com status 10 não entra',()=>assert.equal(C.summarizeTracking(payload([t(10,1794934114,'[Ops99] RETORNO')])).ok,false));
test('último status 1 e não primeiro, mesmo com rota posterior',()=>{
  const v=C.summarizeTracking(payload([
    t(1,1794000000,'[Ops100] ANTIGO'),
    t(1,1794100000,'[Ops200] NOVO'),
    t(2,1794100001,'Admin',{message:'Pedido em processamento na Assignment Task [AT20261113CNHVJ]'})
  ]));
  assert.equal(v.ok,true);assert.equal(v.ops,'Ops200');assert.equal(v.name,'NOVO');assert.equal(v.assignmentId,'AT20261113CNHVJ');
});
test('não confunde retorno mais recente com último recebimento normal',()=>{
  const r=C.summarizeTracking(payload([t(1,1794000000,'[Ops1] ANA'),t(10,1794100000,'[Ops2] BIA')]));
  assert.equal(r.ops,'Ops1');
});
test('recebimento antigo não empresta OPS ao último sem OPS',()=>{
  const r=C.summarizeTracking(payload([t(1,1794000000,'[Ops1] ANA'),t(1,1794100000,'Admin')]));
  assert.equal(r.ok,false);assert.equal(r.reason,'ops_nao_identificado');
});
test('sem status textual ainda fornece diagnóstico numérico',()=>{
  const r=C.summarizeTracking(payload([t(3,1794000000,'') ]));
  assert.equal(r.reason,'recebimento_nao_identificado');assert.equal(r.diagnostic.statusCounts['3'],1);
});
test('OPS em colchetes com e sem prefixo Ops',()=>{
  assert.equal(C.parseOperator({operator:'[Ops131849] GISELI'}).ops,'Ops131849');
  assert.equal(C.parseOperator({operator:'[33371] IVONE'}).ops,'Ops33371');
});
test('OPS em campo estruturado numérico',()=>{
  const r=C.parseOperator({operator_id:33371,operator_name:'IVONE'});
  assert.deepEqual(r,{ops:'Ops33371',name:'IVONE'});
});
test('OPS do Admin não vira operador',()=>assert.equal(C.parseOperator({operator:'Admin(Dynamic Routing)'}),null));
test('mesmo timestamp com OPSs diferentes rejeita',()=>{
  const r=C.summarizeTracking(payload([t(1,1794100000,'[Ops1] ANA'),t(1,1794100000,'[Ops2] BIA')]));
  assert.equal(r.reason,'operadores_conflitantes_mesmo_horario');
});
test('evento duplicado com OPS e sem OPS no mesmo timestamp usa o identificado',()=>{
  const r=C.summarizeTracking(payload([t(1,1794100000,'[Ops1] ANA'),t(1,1794100000,'Admin')]));
  assert.equal(r.ops,'Ops1');
});
test('filtra estação atual quando a estação aparece no rastreio',()=>{
  const r=C.summarizeTracking(payload([t(1,1794000000,'[Ops1] ANA',{station_id:5459}),t(1,1794100000,'[Ops2] BIA',{station_id:666})]),{stationId:'5459'});
  assert.equal(r.ops,'Ops1');
});
test('sem horário do recebimento não inventa último',()=>{
  const r=C.summarizeTracking(payload([{status:1,operator:'[Ops1] ANA'}]));
  assert.equal(r.reason,'horario_recebimento_indeterminado');
});
test('Fallback Gestão de Recebimento exige BR e tempo iguais',()=>{
  const at=1794100000*1000;
  const r=C.confirmReceiveTask({data:{list:[{spx_tracking_number:'BR123456789012A',complete_time:1794100002,operator:'[33371] IVONE'}]}},'BR123456789012A',at);
  assert.equal(r.ops,'Ops33371');
  const bad=C.confirmReceiveTask({data:{list:[{spx_tracking_number:'BR123456789012A',complete_time:1794200000,operator:'[33371] IVONE'}]}},'BR123456789012A',at);
  assert.equal(bad.ok,false);
});
test('Fallback não aceita outra encomenda e nem primeira linha sem BR',()=>{
  const r=C.confirmReceiveTask({data:{list:[{spx_tracking_number:'BR444',complete_time:1794100000,operator:'[33371] IVONE'},{operator:'[111] ANA',complete_time:1794100000}]}},'BR123456789012A',1794100000*1000);
  assert.equal(r.ok,false);
});
test('lista de BRs mantém unicidade e não aceita SPXBR embutido',()=>{
  assert.deepEqual(C.parseBrs('BR123456789012A\nBR123456789012A\nSPXBR123456789012B'),['BR123456789012A']);
});
test('ranking de OPS AM/PM/Geral não duplica BR nem soma turno desconhecido',()=>{
  const d=[{ok:true,br:'BR1',ops:'Ops1',name:'ANA',shift:'AM'},
    {ok:true,br:'BR2',ops:'Ops2',name:'BIA',shift:'PM'},
    {ok:true,br:'BR3',ops:'Ops1',name:'ANA',shift:''},
    {ok:true,br:'BR1',ops:'Ops1',name:'ANA',shift:'AM'}];
  assert.equal(C.buildRanking(d).counted,3);assert.equal(C.buildRanking(d).unclassified,1);
  assert.equal(C.buildRanking(d,'AM').counted,1);assert.equal(C.buildRanking(d,'PM').counted,1);
});
test('VT identificada por data de criação real e não pelo ID',()=>{
  const r=A.assignShifts([{task_number:'VT20261118ABC',create_time:1794959816}], '2026-11-17');
  assert.equal(r.length,1);assert.equal(r[0].shift,'AM');
});
test('AM, PM, PM2 seguem ordem de abertura, ainda que PM abra antes do meio-dia',()=>{
  const raw=[{task_number:'VT20261117PM',create_time:1794925316},
    {task_number:'VT20261117AM',create_time:1794898603},
    {task_number:'VT20261117PM2',create_time:1794938400}];
  const vts=A.assignShifts(raw,'2026-11-17');
  assert.equal(vts.length,3);assert.deepEqual(vts.map(v=>v.shift),['AM','PM','PM2']);
});
test('VT sem horário de criação não recebe turno',()=>{
  const vt=A.assignShifts([{task_number:'VT20261117ABC',complete_time:1794898603}], '2026-11-17');
  assert.equal(vt.length,0);
});
test('tarefas de outra estação são excluídas quando estação fornecida',()=>{
  const vt=A.assignShifts([{task_number:'VT20261117ABC',create_time:1794898603,station_id:'44'}], '2026-11-17','5459');
  assert.equal(vt.length,0);
});
test('busca audit/task/list identifica duas VTs com paginação',async()=>{
  const rows=[{task_number:'VT20261117ABC',create_time:1794898603},{task_number:'VT20261117DEF',create_time:1794925316}];
  const logs=[];
  const request=async url=>{logs.push(url);return {data:{list:rows,total:2}}};
  const result=await A.discoverVts('2026-11-17',request);
  assert.equal(result.vts.length,2);assert.equal(result.vts[0].shift,'AM');assert.equal(result.vts[1].shift,'PM');assert.equal(logs.length,1);
});
test('audit: BR na VT AM e de novo na VT PM conta na primeira',async()=>{
  const vts=[{vt:'VT20261117AAA',shift:'AM',start:1794898603000},{vt:'VT20261117BBB',shift:'PM',start:1794925316000}];
  const urls=[];
  const request=async url=>{
    urls.push(url);
    const u=new URL(url,'https://spx.shopee.com.br');
    if(u.pathname.endsWith('/target/list')) return {data:{list:[{target_id:'AT123456789',missing_qty:1,missort_qty:0,binding_entity:'A-5'}],total:1}};
    if(u.pathname.endsWith('/parcel/list')) return {data:{list:[{shipment_id:'BR123456789012A',validation_status:5,next_step_action:''}],total:1}};
    throw Error('bad URL');
  };
  const r=await A.locateInVts(vts,['BR123456789012A'],request);
  assert.equal(r.found.get('BR123456789012A').shift,'AM');
  assert.equal(r.found.size,1);
  assert.ok(urls.every(x=>x.startsWith('/api/in-station/lmhub/audit/')));
});
test('audit: sem VT/BR comprovado não marca AM por horário do recebimento',async()=>{
  const request=async url=>({data:{list:url.includes('/target/list')?[{target_id:'AT123456789',missing_qty:0,missort_qty:0}]:[],total:1}});
  const r=await A.locateInVts([{vt:'VT20261117AAA',shift:'AM',start:1794898603000}],['BR123456789012A'],request);
  assert.equal(r.found.size,0);
});
test('audit: ignora pacote em rota sem exceção válida',async()=>{
  const request=async url=>({data:{list:url.includes('/target/list')?[{target_id:'AT123456789',missing_qty:1,missort_qty:0}]:[{shipment_id:'BR123456789012A',validation_status:4,next_step_action:''}],total:1}});
  const r=await A.locateInVts([{vt:'VT20261117AAA',shift:'AM',start:1794898603000}],['BR123456789012A'],request);
  assert.equal(r.found.size,0);
});
test('audit: erro de consulta registra varredura incompleta sem atribuir turno',async()=>{
  const request=async()=>{throw Error('HTTP 503')};
  const r=await A.locateInVts([{vt:'VT20261117AAA',shift:'AM',start:1794898603000}],['BR123456789012A'],request);
  assert.equal(r.found.size,0);assert.equal(r.incomplete,true);assert.equal(r.issues.length,1);
});

test('simulação 33 BRs: todos os recebimentos status 1 geram ranking sem duplicatas',()=>{
  const results=Array.from({length:33},(_,i)=>{
    const br=`BR${String(2600000000000+i)}A`;
    const op=i%2===0?'[Ops100] ANA':'[Ops200] BIA';
    return {br,...C.summarizeTracking(payload([t(1,1794938400,op)]))};
  });
  const sum=C.buildRanking(results);
  assert.equal(sum.counted,33);assert.equal(sum.ranking.length,2);
  assert.deepEqual(sum.ranking.map(r=>r.count),[17,16]);
  assert.equal(sum.unknown.length,0);
});

test('paginação VT não para antes quando SPX retorna menos linhas que count',async()=>{
  const rows=Array.from({length:5},(_,i)=>({task_number:`VT20261117TEST${i}`,create_time:1794898603+i*3600}));
  let calls=0;
  const result=await A.discoverVts('2026-11-17',async url=>{
    const u=new URL(url,'https://spx.shopee.com.br');
    const page=Number(u.searchParams.get('pageno') || u.searchParams.get('page_no') || 1);
    calls++;return {data:{list:rows.slice((page-1)*2,page*2),total:5}};
  });
  assert.equal(result.vts.length,5);assert.equal(calls,3);
});

test('paginação VT repetida tenta parâmetro alternativo',async()=>{
  const rows=[{task_number:'VT20261117AAAA',create_time:1794898603},{task_number:'VT20261117BBBB',create_time:1794925316}];
  const result=await A.discoverVts('2026-11-17',async url=>{
    const u=new URL(url,'https://spx.shopee.com.br');
    if(u.searchParams.has('pageno')) return {data:{list:[rows[0]],total:2}};
    return {data:{list:[rows[Number(u.searchParams.get('page_no'))-1]],total:2}};
  });
  assert.equal(result.vts.length,2);
});
