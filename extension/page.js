(() => {
  'use strict';
  if (window.__spxErrosEtiquetagemApp) return;
  const core = window.__spxErrosEtiquetagemCore;
  if (!core || location.hostname !== 'spx.shopee.com.br') return;

  const ID = 'spx-etq-root';
  const app = {opened: false, running: false, stopped: false, controller: null, data: [], input: [], runId: 0, selected: '', diagnostics: []};
  let element = null, shadow = null;
  const esc = text => String(text ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date = time => time ? new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo'}).format(time) : '—';
  const $ = selector => shadow.querySelector(selector);

  function mount() {
    if (element?.isConnected) return;
    element = document.createElement('div');
    element.id = ID;
    element.style.cssText = 'all:initial;position:fixed;right:18px;top:24px;z-index:2147483647;';
    shadow = element.attachShadow({mode: 'open'});
    shadow.innerHTML = `
      <style>
        *{box-sizing:border-box} :host{color-scheme:dark;font:13px/1.4 Arial,Helvetica,sans-serif}
        .card{background:#101419;color:#f6f7f9;width:min(680px,calc(100vw - 32px));max-height:calc(100vh - 46px);overflow:hidden;border:1px solid #d97706;border-radius:12px;box-shadow:0 16px 65px #0009;display:flex;flex-direction:column}
        header{padding:11px 14px;background:#c2410c;display:flex;align-items:center;gap:10px;cursor:move;user-select:none;flex:none}
        header strong{font-size:17px;flex:1}header small{font-size:11px;opacity:.92}header button{width:29px;height:29px}
        main{padding:12px;overflow:auto;min-height:0} textarea{display:block;width:100%;height:86px;min-height:64px;resize:vertical;background:#1d242c;color:#fff;border:1px solid #475569;padding:9px;border-radius:7px;font:12px/1.4 monospace}
        p{margin:5px 0 10px;color:#cbd5e1} .actions{display:flex;gap:8px;align-items:center;margin:9px 0;flex-wrap:wrap}
        button{background:#293444;color:#fff;border:1px solid #64748b;border-radius:7px;padding:8px 12px;cursor:pointer;font-weight:bold}button:hover{filter:brightness(1.13)}button:disabled{opacity:.38;cursor:not-allowed}
        button.primary{background:#ea580c;border-color:#fb923c}.status{font-size:12px;color:#fde68a;min-height:19px}
        .summary{margin:8px 0;color:#e2e8f0;font-size:12px}.summary strong{color:#fff} .muted{font-size:11px;color:#9ca3af}
        table{border-collapse:collapse;width:100%;font-size:12px;margin-top:7px}th,td{border-bottom:1px solid #334155;padding:8px 7px;text-align:left;vertical-align:top}th{background:#202a34;position:sticky;top:0}td.num,th.num{text-align:right;font-weight:bold}tr.selectable{cursor:pointer}tr.selectable:hover{background:#26303b}tr.selected{background:#243746}
        details{margin-top:12px;border:1px solid #334155;border-radius:7px;padding:8px}summary{cursor:pointer;font-weight:700}
        ul{padding-left:20px;margin:6px 0}.help{font-size:11px;color:#aebdca;margin-top:10px}
        progress{width:100%;height:7px;accent-color:#f97316}
        .break{overflow-wrap:anywhere}
      </style>
      <div class="card">
        <header><strong>ETQ · Erros de Etiquetagem</strong><small>v0.1.1</small><button id="close" aria-label="Ocultar painel">×</button></header>
        <main>
          <p>Cole os BRs com erro. Cada BR único contará <b>uma vez</b> para o OPS do <b>último LMHub_Recebido</b>.</p>
          <textarea id="input" placeholder="BR123456789012A&#10;BR123456789012B&#10;..." spellcheck="false"></textarea>
          <div class="actions"><button class="primary" id="start">Pesquisar e gerar ranking</button><button id="stop" disabled>Parar</button><button id="copy" disabled>Copiar ranking</button><span id="amount" class="muted">0 BRs válidos</span></div>
          <progress id="progress" max="1" value="0" hidden></progress>
          <div class="status" id="status" role="status" aria-live="polite">Aguardando lista.</div>
          <div class="summary" id="summary"></div>
          <section id="results"></section>
          <p class="help">Consulta apenas leitura na sessão atual do SPX. Sem envio a servidores externos nem armazenamento da lista. OPS não confirmado não entra no ranking. Corredor/Gaiola é informação auxiliar, nunca critério de contagem.</p>
        </main>
      </div>`;
    (document.body || document.documentElement).appendChild(element);
    $('#close').addEventListener('click', () => toggle());
    $('#start').addEventListener('click', run);
    $('#stop').addEventListener('click', stop);
    $('#copy').addEventListener('click', copyRanking);
    $('#input').addEventListener('input', () => {$('#amount').textContent = `${core.parseBrs($('#input').value).length} BRs válidos`;});
    enableDrag();
  }

  function enableDrag() {
    let origin = null;
    shadow.querySelector('header').addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      origin = {x:event.clientX,y:event.clientY,left:element.getBoundingClientRect().left,top:element.getBoundingClientRect().top};
      element.style.right = 'auto';
      try {shadow.querySelector('header').setPointerCapture(event.pointerId);} catch {}
    });
    shadow.querySelector('header').addEventListener('pointermove', event => {
      if (!origin) return;
      element.style.left = `${Math.max(0,Math.min(window.innerWidth - 90, origin.left + event.clientX - origin.x))}px`;
      element.style.top = `${Math.max(0,Math.min(window.innerHeight - 45, origin.top + event.clientY - origin.y))}px`;
    });
    shadow.querySelector('header').addEventListener('pointerup', () => {origin=null;});
    shadow.querySelector('header').addEventListener('pointercancel', () => {origin=null;});
  }

  function toggle() {
    mount();
    app.opened = !app.opened;
    element.style.display = app.opened ? 'block' : 'none';
    return {opened: app.opened};
  }

  function status(message) {$('#status').textContent = message;}
  function stop() {
    app.stopped = true;
    app.controller?.abort();
    status('Parada solicitada. Resultados já consultados serão preservados.');
  }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function requestJson(url, options, token) {
    if (app.stopped || token !== app.runId) throw new Error('interrompido');
    const response = await fetch(url, {credentials:'include', cache:'no-store', ...options, signal:app.controller.signal});
    if (response.status === 401 || response.status === 403) throw new Error('Acesso recusado pelo SPX. Confira sua sessão e permissões.');
    if (!response.ok) throw new Error(`SPX respondeu HTTP ${response.status}`);
    const body = await response.json();
    if (body?.retcode != null && Number(body.retcode) !== 0) throw new Error(`SPX recusou consulta (retcode ${body.retcode}).`);
    return body;
  }

  async function processBr(br, token, laneCache) {
    const response = await requestJson(`/api/fleet_order/order/detail/tracking_info?shipment_id=${encodeURIComponent(br)}`, {}, token);
    const result = core.summarizeTracking(response);
    if (!result.ok) return {br, ...result};
    const output = {br, ...result, lane: ''};
    if (result.assignmentId) {
      try {
        let pending = laneCache.get(result.assignmentId);
        if (!pending) {
          pending = requestJson('/spx_delivery/admin/assignment/assignment_task/search/v2', {
            method:'POST', headers:{'Content-Type':'application/json;charset=UTF-8'},
            body:JSON.stringify({assignment_task_id:result.assignmentId,pageno:1,count:20,search_type:0})
          }, token).then(res => core.extractLane(res, result.assignmentId));
          laneCache.set(result.assignmentId,pending);
        }
        const found = await pending;
        if (found.ok) output.lane=found.lane;
        else output.laneReason=found.reason;
      } catch (error) {
        output.laneReason='consulta_rua_falhou';
      }
    }
    return output;
  }

  async function run() {
    if (app.running) return;
    const brs = core.parseBrs($('#input').value);
    if (!brs.length) {status('Cole pelo menos um BR válido.');return;}
    app.running = true;app.stopped=false;app.controller = new AbortController();
    app.runId += 1;
    const token = app.runId;
    app.input = brs;
    app.data=[];app.selected='';app.diagnostics=[];
    $('#start').disabled=true;$('#stop').disabled=false;$('#copy').disabled=true;
    $('#progress').hidden=false;$('#progress').max=brs.length;$('#progress').value=0;
    $('#results').replaceChildren();$('#summary').replaceChildren();
    const laneCache = new Map();
    let position = 0, done = 0;
    async function worker() {
      while (!app.stopped && token === app.runId) {
        const i = position++;
        if (i >= brs.length) break;
        const br = brs[i];
        try {
          const result = await processBr(br, token, laneCache);
          app.data.push(result);
        } catch (error) {
          if (app.stopped || token !== app.runId || error?.name === 'AbortError') break;
          app.data.push({br,ok:false,reason:'falha_consulta',detail:String(error?.message || error)});
          if (/Acesso recusado|HTTP 429|HTTP 503/i.test(String(error?.message))) {app.stopped=true;app.controller.abort();}
        }
        done += 1;
        $('#progress').value=done;
        status(`${done} de ${brs.length} BRs pesquisados${app.stopped ? ' · interrompido' : ''}.`);
        if (done % 5 === 0 || done === brs.length) render();
        if (!app.stopped) await sleep(90);
      }
    }
    try {await Promise.all(Array.from({length:Math.min(3,brs.length)},worker));}
    finally {
      if (token === app.runId) {
        app.running=false;$('#start').disabled=false;$('#stop').disabled=true;
        $('#copy').disabled=!app.data.some(r=>r.ok);
        render();
        status(app.stopped ? `Pesquisa interrompida. ${app.data.length} de ${brs.length} BRs processados.` : `Concluído: ${app.data.length} BRs processados.`);
      }
    }
  }

  function render() {
    const summary = core.buildRanking(app.data);
    const total = app.input.length;
    const completed = app.data.length;
    $('#summary').innerHTML = `<strong>${total}</strong> BRs únicos · <strong>${completed}</strong> consultados · <strong>${summary.counted}</strong> com OPS identificado · <strong>${summary.unknown.length}</strong> sem atribuição segura`;
    const rows = summary.ranking.map((item,i) => `<tr class="selectable ${app.selected === item.ops ? 'selected':''}" data-ops="${esc(item.ops)}"><td>${i+1}º</td><td class="break">${esc(item.ops)}</td><td class="break">${esc(item.name)}</td><td class="num">${item.count}</td></tr>`).join('');
    let html = `<table><thead><tr><th>Ranking</th><th>OPS</th><th>Operador</th><th class="num">Erros (BRs)</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nenhum OPS confirmado até agora.</td></tr>'}</tbody></table>`;
    const selected = summary.ranking.find(e => e.ops === app.selected);
    if (selected) {
      html += `<details open><summary>${esc(selected.name)} — ${selected.count} BR(s)</summary><table><thead><tr><th>BR</th><th>Último recebimento</th><th>Rua*</th></tr></thead><tbody>` + selected.details.map(d => `<tr><td class="break">${esc(d.br)}</td><td>${esc(date(d.receivedAt))}</td><td>${esc(d.lane || '—')}</td></tr>`).join('') + `</tbody></table><p class="muted">*Rua proveniente da AT identificada após o último recebimento, somente quando a correspondência pôde ser confirmada.</p></details>`;
    }
    if (summary.unknown.length) {
      const reasonNames = {recebimento_nao_identificado:'LMHub_Recebido não identificado na resposta',horario_recebimento_indeterminado:'Horário do recebimento indeterminado',ops_nao_identificado:'OPS ausente no último recebimento',operadores_conflitantes_mesmo_horario:'Operadores diferentes no mesmo horário',falha_consulta:'Falha de consulta ao SPX'};
      html += `<details><summary>BRs não atribuídos (${summary.unknown.length})</summary><table><thead><tr><th>BR</th><th>Motivo</th></tr></thead><tbody>` + summary.unknown.map(d => `<tr><td class="break">${esc(d.br)}</td><td>${esc(reasonNames[d.reason] || d.reason || 'Indeterminado')}</td></tr>`).join('') + `</tbody></table><button id="diagnostic">Copiar diagnóstico resumido</button></details>`;
    }
    $('#results').innerHTML=html;
    shadow.querySelectorAll('[data-ops]').forEach(row => row.addEventListener('click',() => {app.selected=row.dataset.ops === app.selected ? '' : row.dataset.ops;render();}));
    $('#diagnostic')?.addEventListener('click', async () => {
      const data=summary.unknown.map(item=>({br:item.br,reason:item.reason,detail:item.detail||'',diagnostic:item.diagnostic||{}}));
      await copyText(JSON.stringify({version:'0.1.0',results:data},null,2));
      status('Diagnóstico resumido copiado. Confira o conteúdo antes de compartilhar.');
    });
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();
    try {document.execCommand('copy');} finally{input.remove();}
  }

  async function copyRanking() {
    const {ranking} = core.buildRanking(app.data);
    if (!ranking.length) return;
    const content=['POSIÇÃO\tOPS\tOPERADOR\tERROS (BRS)',...ranking.map((o,i)=>`${i+1}\t${o.ops}\t${o.name}\t${o.count}`)].join('\n');
    try {await copyText(content);status('Ranking copiado para colar no Excel ou Google Sheets.');}
    catch {status('Não foi possível copiar. Confira a permissão da área de transferência.');}
  }

  window.__spxErrosEtiquetagemApp = Object.freeze({toggle});
})();