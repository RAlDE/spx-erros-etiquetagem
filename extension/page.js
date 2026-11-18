(() => {
  'use strict';
  if (window.__spxErrosEtiquetagemApp) return;
  const core = window.__spxErrosEtiquetagemCore;
  const audit = window.__spxErrosEtiquetagemAudit;
  if (!core || !audit || location.hostname !== 'spx.shopee.com.br') return;

  const ID = 'spx-etq-root';
  const VERSION='0.1.3';
  const app = {opened:false,running:false,stopped:false,controller:null,data:[],input:[],runId:0,
    selected:'',mode:'GERAL',auditDay:'',vts:[],auditInfo:'',auditIssues:[],auditIncomplete:false};
  let element=null,shadow=null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date = time => time ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Sao_Paulo'}).format(time) : '—';
  const todaySP = () => new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
  const $ = selector => shadow.querySelector(selector);
  const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));

  function mount() {
    if (element?.isConnected) return;
    element=document.createElement('div'); element.id=ID;
    element.style.cssText='all:initial;position:fixed;right:18px;top:24px;z-index:2147483647;';
    shadow=element.attachShadow({mode:'open'});
    shadow.innerHTML=`
      <style>
        *{box-sizing:border-box}:host{color-scheme:dark;font:13px/1.4 Arial,Helvetica,sans-serif}
        .card{background:#101419;color:#f6f7f9;width:min(730px,calc(100vw - 32px));max-height:calc(100vh - 46px);overflow:hidden;border:1px solid #d97706;border-radius:12px;box-shadow:0 16px 65px #0009;display:flex;flex-direction:column}
        header{padding:11px 14px;background:#c2410c;display:flex;align-items:center;gap:10px;cursor:move;user-select:none;flex:none}
        header strong{font-size:17px;flex:1}header small{font-size:11px;opacity:.92}header button{width:29px;height:29px}
        main{padding:12px;overflow:auto;min-height:0}
        textarea{display:block;width:100%;height:85px;min-height:62px;resize:vertical;background:#1d242c;color:#fff;border:1px solid #475569;padding:9px;border-radius:7px;font:12px/1.4 monospace}
        input[type=date]{background:#1d242c;color:#fff;border:1px solid #64748b;border-radius:7px;padding:7px;font:13px Arial}
        p{margin:5px 0 10px;color:#cbd5e1}.actions{display:flex;gap:8px;align-items:center;margin:9px 0;flex-wrap:wrap}
        button{background:#293444;color:#fff;border:1px solid #64748b;border-radius:7px;padding:8px 11px;cursor:pointer;font-weight:700}button:hover{filter:brightness(1.13)}button:disabled{opacity:.4;cursor:not-allowed}
        button.primary{background:#ea580c;border-color:#fb923c}.status{font-size:12px;color:#fde68a;min-height:19px;overflow-wrap:anywhere}
        .summary{margin:8px 0;color:#e2e8f0;font-size:12px}.summary strong{color:#fff}.muted{font-size:11px;color:#9ca3af}
        .datebox{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px;padding:8px;background:#19212a;border-radius:7px}
        .datebox label{font-size:12px;font-weight:700}.datebox .hint{font-size:11px;color:#9ca3af;flex:1;min-width:180px}
        .tabs{display:flex;gap:6px;margin:11px 0 5px;flex-wrap:wrap}.tabs button{padding:6px 12px}
        .tabs button.active{background:#ea580c;border-color:#f97316}
        table{border-collapse:collapse;width:100%;font-size:12px;margin-top:7px}th,td{border-bottom:1px solid #334155;padding:8px 7px;text-align:left;vertical-align:top}th{background:#202a34;position:sticky;top:0}td.num,th.num{text-align:right;font-weight:700}
        tr.selectable{cursor:pointer}tr.selectable:hover{background:#26303b}tr.selected{background:#243746}
        details{margin-top:12px;border:1px solid #334155;border-radius:7px;padding:8px}summary{cursor:pointer;font-weight:700}
        .help{font-size:11px;color:#aebdca;margin-top:10px}.notice{padding:8px;background:#262315;border:1px solid #6b541c;border-radius:6px;color:#fcd34d;font-size:12px;margin:8px 0}
        progress{width:100%;height:7px;accent-color:#f97316}.break{overflow-wrap:anywhere}
      </style>
      <div class="card">
        <header><strong>ETQ · Erros de Etiquetagem</strong><small>v${VERSION}</small><button id="close" aria-label="Ocultar painel">×</button></header>
        <main>
          <p>Cole os BRs com erro de etiqueta. Cada BR único vale <b>um erro</b> para o OPS do <b>último recebimento normal</b>.</p>
          <textarea id="input" placeholder="BR123456789012A&#10;BR123456789012B&#10;..." spellcheck="false"></textarea>
          <div class="datebox"><label for="auditDate">Data da conferência VT:</label><input id="auditDate" type="date"/>
          <span class="hint">AM/PM pela 1ª/2ª VT criada nesta data. Não é o turno do recebimento.</span></div>
          <div class="actions"><button class="primary" id="start">Pesquisar e gerar ranking</button>
          <button id="stop" disabled>Parar</button><button id="copy" disabled>Copiar ranking</button><span id="amount" class="muted">0 BRs válidos</span></div>
          <progress id="progress" max="1" value="0" hidden></progress>
          <div class="status" id="status" role="status" aria-live="polite">Aguardando lista.</div>
          <div class="summary" id="summary"></div>
          <div class="tabs" id="tabs"><button data-mode="GERAL" class="active">Geral</button><button data-mode="AM">AM</button><button data-mode="PM">PM</button></div>
          <section id="results"></section>
          <p class="help">Consultas de leitura na sessão SPX. OPS do evento normal status 1; Return status 10 é excluído. O turno só é contado quando o BR é encontrado nas exceções de uma VT da data escolhida. Sem armazenamento ou envio de dados a servidores externos.</p>
        </main>
      </div>`;
    (document.body || document.documentElement).appendChild(element);
    $('#auditDate').value=todaySP();
    $('#close').addEventListener('click',toggle);
    $('#start').addEventListener('click',run);
    $('#stop').addEventListener('click',stop);
    $('#copy').addEventListener('click',copyRanking);
    $('#input').addEventListener('input',()=>{$('#amount').textContent=`${core.parseBrs($('#input').value).length} BRs válidos`;});
    shadow.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
      app.mode=button.dataset.mode;app.selected='';render();
    }));
    enableDrag();
  }

  function enableDrag() {
    let origin=null;
    shadow.querySelector('header').addEventListener('pointerdown',event=>{
      if(event.button!==0 || event.target.closest('button')) return;
      origin={x:event.clientX,y:event.clientY,left:element.getBoundingClientRect().left,top:element.getBoundingClientRect().top};
      element.style.right='auto';
      try{shadow.querySelector('header').setPointerCapture(event.pointerId);}catch{}
    });
    shadow.querySelector('header').addEventListener('pointermove',event=>{
      if(!origin) return;
      element.style.left=`${Math.max(0,Math.min(window.innerWidth-90,origin.left+event.clientX-origin.x))}px`;
      element.style.top=`${Math.max(0,Math.min(window.innerHeight-45,origin.top+event.clientY-origin.y))}px`;
    });
    shadow.querySelector('header').addEventListener('pointerup',()=>{origin=null;});
    shadow.querySelector('header').addEventListener('pointercancel',()=>{origin=null;});
  }
  function toggle() {mount();app.opened=!app.opened;element.style.display=app.opened?'block':'none';return {opened:app.opened};}
  function status(message) {$('#status').textContent=message;}
  function stop() {app.stopped=true;app.controller?.abort();status('Pesquisa interrompida; resultados já obtidos foram preservados.');}

  async function requestJson(url,options,token) {
    if(app.stopped || token!==app.runId) throw new Error('interrompido');
    const response=await fetch(url,{credentials:'include',cache:'no-store',...options,signal:app.controller.signal});
    if(response.status===401 || response.status===403) throw new Error('Acesso recusado pelo SPX. Verifique a sessão e as permissões.');
    if(!response.ok) throw new Error(`SPX respondeu HTTP ${response.status}`);
    const body=await response.json();
    if(body?.retcode!=null && Number(body.retcode)!==0) throw new Error(`SPX recusou consulta (retcode ${body.retcode}).`);
    return body;
  }
  const api=(url,token,options={})=>requestJson(url,options,token);

  async function processBr(br,token,laneCache,stationId) {
    const response=await api(`/api/fleet_order/order/detail/tracking_info?shipment_id=${encodeURIComponent(br)}`,token);
    let result=core.summarizeTracking(response,{stationId});
    if(!result.ok && result.reason==='ops_nao_identificado' && result.receivedAt) {
      try{
        const search=await api('/api/in-station/uni_receive/receive_management/receive_task/list?'+
          new URLSearchParams({count:24,pageno:1,spx_tracking_number:br}),token);
        const fallback=core.confirmReceiveTask(search,br,result.receivedAt);
        if(fallback.ok) result={ok:true,ops:fallback.ops,name:fallback.name,
          receivedAt:result.receivedAt,assignmentId:'',source:'gestao_recebimento_confirmada'};
        else result={...result,diagnostic:{...result.diagnostic,receiveTaskReason:fallback.reason}};
      }catch(error){
        if(app.stopped) throw error;
        result={...result,diagnostic:{...result.diagnostic,receiveTaskReason:'falha_consulta_tarefa'}};
      }
    }
    if(!result.ok) return {br,...result};
    const output={br,...result,lane:'',shift:'',vt:''};
    if(result.assignmentId) {
      try{
        let pending=laneCache.get(result.assignmentId);
        if(!pending){
          pending=api('/spx_delivery/admin/assignment/assignment_task/search/v2',token,{
            method:'POST',headers:{'Content-Type':'application/json;charset=UTF-8'},
            body:JSON.stringify({assignment_task_id:result.assignmentId,pageno:1,count:20,search_type:0})
          }).then(res=>core.extractLane(res,result.assignmentId));
          laneCache.set(result.assignmentId,pending);
        }
        const found=await pending;
        if(found.ok) output.lane=found.lane;
        else output.laneReason=found.reason;
      }catch(error){if(app.stopped) throw error;output.laneReason='consulta_rua_falhou';}
    }
    return output;
  }

  async function run() {
    if(app.running) return;
    const brs=core.parseBrs($('#input').value);
    if(!brs.length){status('Cole pelo menos um BR válido.');return;}
    const auditDay=$('#auditDate').value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(auditDay)){status('Informe a data da conferência VT.');return;}
    app.running=true;app.stopped=false;app.controller=new AbortController();app.runId++;
    const token=app.runId;
    app.input=brs;app.data=[];app.selected='';app.mode='GERAL';app.auditDay=auditDay;
    app.vts=[];app.auditInfo='';app.auditIssues=[];app.auditIncomplete=false;app.auditDiagnostics={};
    $('#start').disabled=true;$('#stop').disabled=false;$('#copy').disabled=true;$('#auditDate').disabled=true;
    $('#progress').hidden=false;$('#progress').max=brs.length;$('#progress').value=0;
    $('#results').replaceChildren();$('#summary').replaceChildren();
    const laneCache=new Map();
    let stationId='';
    try{
      const station=await api('/api/admin/basicserver/current_user/current_station_info',token);
      stationId=String(station?.data?.current_station_id || '');
    }catch{ /* permissão opcional: sem ela não inventamos filtro de estação */ }
    let position=0,done=0;
    async function worker(){
      while(!app.stopped && token===app.runId){
        const i=position++;
        if(i>=brs.length) break;
        const br=brs[i];
        try{app.data.push(await processBr(br,token,laneCache,stationId));}
        catch(error){
          if(app.stopped || token!==app.runId || error?.name==='AbortError') break;
          app.data.push({br,ok:false,reason:'falha_consulta',detail:String(error?.message || error)});
          if(/Acesso recusado|HTTP 429|HTTP 503/i.test(String(error?.message))){app.stopped=true;app.controller.abort();}
        }
        done++;
        $('#progress').value=done;
        status(`Rastreamento: ${done}/${brs.length} BRs pesquisados${app.stopped?' · interrompido':''}.`);
        if(done%3===0 || done===brs.length) render();
        if(!app.stopped) await sleep(90);
      }
    }
    try{
      await Promise.all(Array.from({length:Math.min(3,brs.length)},worker));
      render();
      // Buscar VTs independentemente de haver OPS reconhecido. Na 0.1.2,
      // com todos os BRs sem OPS, a consulta VT nem era iniciada (vtCount=0).
      if(!app.stopped){
        status('Rastreamento concluído. Procurando conferências VT na data informada…');
        const requester=url=>api(url,token);
        const vts=await audit.discoverVts(auditDay,requester,status,()=>app.stopped,stationId);
        app.vts=vts.vts||[];
        app.auditIncomplete=!!vts.incomplete;
        app.auditDiagnostics=vts.diagnostics||{};
        if(vts.error) app.auditInfo=`Consulta de VTs: ${vts.error}`;
        else if(!app.vts.length) app.auditInfo=`Nenhuma VT com abertura confirmada em ${auditDay}. ${vts.scannedTasks || 0} tarefas examinadas; verifique a data e o diagnóstico.`;
        if(app.vts.length && app.data.some(x=>x.ok)){
          const scanned=await audit.locateInVts(app.vts,app.data.filter(x=>x.ok).map(x=>x.br),
            requester,status,()=>app.stopped);
          for(const item of app.data){
            const found=scanned.found?.get(item.br);
            if(found){item.shift=found.shift;item.vt=found.vt;item.auditAt=found.auditAt;
              if(!item.lane) item.lane=found.lane || '';}
          }
          app.auditIssues=scanned.issues||[];
          app.auditIncomplete ||= !!scanned.incomplete;
          if(app.auditIssues.length) app.auditInfo+=` ${app.auditIssues.length} consultas de auditoria falharam.`;
          if(app.auditIncomplete) app.auditInfo+=' Varredura incompleta: alguns turnos podem não ter sido localizados.';
        } else if(app.vts.length) {
          app.auditInfo=`${app.vts.length} VT(s) localizada(s), porém sem OPS confirmado para relacionar BRs ao ranking.`;
        }
      }
    }catch(error){
      if(!app.stopped){app.auditIncomplete=true;app.auditInfo=`Falha na identificação do turno: ${String(error.message || error)}`;}
    }finally{
      if(token===app.runId){
        app.running=false;$('#start').disabled=false;$('#stop').disabled=true;$('#auditDate').disabled=false;
        $('#progress').hidden=true;
        render();
        const sum=core.buildRanking(app.data);
        status(app.stopped ? `Interrompido: ${app.data.length}/${brs.length} BRs pesquisados.` :
          `Concluído: ${app.data.length} BRs · ${sum.allKnown} com OPS · ${sum.unclassified} sem turno comprovado.`);
      }
    }
  }

  function render() {
    const summary=core.buildRanking(app.data,app.mode);
    const geral=core.buildRanking(app.data,'GERAL');
    const amount=turno=>app.data.filter(r=>r.ok && r.shift===turno).length;
    $('#summary').innerHTML=`<strong>${app.input.length}</strong> BRs únicos · <strong>${app.data.length}</strong> consultados · `+
      `<strong>${geral.counted}</strong> com OPS · <strong>${amount('AM')}</strong> AM · <strong>${amount('PM')}</strong> PM · `+
      `<strong>${geral.unclassified}</strong> turno não identificado · <strong>${geral.unknown.length}</strong> sem OPS`;
    const modes=['GERAL','AM','PM',...new Set(app.vts.map(v=>v.shift).filter(t=>!['AM','PM'].includes(t)))];
    $('#tabs').innerHTML=modes.map(m=>`<button data-mode="${esc(m)}" class="${app.mode===m?'active':''}">${esc(m==='GERAL'?'Geral':m)}</button>`).join('');
    $('#tabs').querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
      app.mode=button.dataset.mode;app.selected='';render();
    }));
    $('#copy').disabled=!summary.ranking.length;
    const rows=summary.ranking.map((item,i)=>`<tr class="selectable ${app.selected===item.ops?'selected':''}" data-ops="${esc(item.ops)}"><td>${i+1}º</td><td class="break">${esc(item.ops)}</td><td class="break">${esc(item.name)}</td><td class="num">${item.count}</td></tr>`).join('');
    let html=`<table><thead><tr><th>Ranking</th><th>OPS</th><th>Operador</th><th class="num">Erros (BRs)</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nenhum OPS confirmado neste filtro.</td></tr>'}</tbody></table>`;
    if(app.auditInfo) html+=`<p class="notice">${esc(app.auditInfo)}</p>`;
    if(app.vts.length) html+=`<details><summary>VTs da conferência (${app.vts.length}) — ${esc(app.auditDay)}</summary>`+
      `<table><thead><tr><th>Turno</th><th>Tarefa VT</th><th>Abertura</th></tr></thead><tbody>`+
      app.vts.map(v=>`<tr><td>${esc(v.shift)}</td><td class="break">${esc(v.vt)}</td><td>${esc(date(v.start))}</td></tr>`).join('')+`</tbody></table></details>`;
    const selected=summary.ranking.find(item=>item.ops===app.selected);
    if(selected) html+=`<details open><summary>${esc(selected.name)} — ${selected.count} BR(s)</summary>`+
      `<table><thead><tr><th>BR</th><th>Último recebimento</th><th>Turno</th><th>VT</th><th>Rua</th></tr></thead><tbody>`+
      selected.details.map(d=>`<tr><td class="break">${esc(d.br)}</td><td>${esc(date(d.receivedAt))}</td><td>${esc(d.shift || '—')}</td><td class="break">${esc(d.vt || '—')}</td><td>${esc(d.lane || '—')}</td></tr>`).join('')+`</tbody></table></details>`;
    if(geral.unknown.length){
      const reasons={recebimento_nao_identificado:'Recebimento normal não identificado',horario_recebimento_indeterminado:'Horário do recebimento indeterminado',
        ops_nao_identificado:'OPS ausente no último recebimento',operadores_conflitantes_mesmo_horario:'OPSs conflitantes no mesmo horário',falha_consulta:'Falha de consulta ao SPX'};
      html+=`<details><summary>BRs sem operador (${geral.unknown.length})</summary><table><thead><tr><th>BR</th><th>Motivo</th></tr></thead><tbody>`+
        geral.unknown.map(d=>`<tr><td class="break">${esc(d.br)}</td><td>${esc(reasons[d.reason]||d.reason||'Indeterminado')}</td></tr>`).join('')+
        `</tbody></table><button id="diagnostic">Copiar diagnóstico resumido</button></details>`;
    }
    $('#results').innerHTML=html;
    $('#results').querySelectorAll('[data-ops]').forEach(row=>row.addEventListener('click',()=>{
      app.selected=row.dataset.ops===app.selected?'':row.dataset.ops;render();
    }));
    $('#diagnostic')?.addEventListener('click',async()=>{
      const data=geral.unknown.map(item=>({br:item.br,reason:item.reason,detail:item.detail||'',diagnostic:item.diagnostic||{}}));
      await copyText(JSON.stringify({version:VERSION,day:app.auditDay,results:data,vtCount:app.vts.length,
        auditIssues:app.auditIssues.map(x=>({stage:x.stage,error:x.error})),
        auditDiagnostics:app.auditDiagnostics,auditIncomplete:app.auditIncomplete},null,2));
      status('Diagnóstico resumido copiado. Confira o conteúdo antes de compartilhar.');
    });
  }
  async function copyText(value) {
    if(navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();
    try{document.execCommand('copy');}finally{input.remove();}
  }
  async function copyRanking() {
    const {ranking}=core.buildRanking(app.data,app.mode);
    if(!ranking.length) return;
    const content=['TURNO\tPOSIÇÃO\tOPS\tOPERADOR\tERROS (BRS)',
      ...ranking.map((o,i)=>`${app.mode}\t${i+1}\t${o.ops}\t${o.name}\t${o.count}`)].join('\n');
    try{await copyText(content);status(`Ranking ${app.mode} copiado para Excel/Google Sheets.`);}
    catch{status('Não foi possível copiar. Confira a permissão da área de transferência.');}
  }
  window.__spxErrosEtiquetagemApp=Object.freeze({toggle});
})();
