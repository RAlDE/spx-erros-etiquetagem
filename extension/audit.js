/* ETQ: associação auditável de um BR à primeira VT de conferência do dia.
 * Adaptado dos ENDPOINTS (não dos dados) da LMH Audit 2.9.0.
 * Não registra recebimentos, não altera VTs e não acessa backend externo.
 */
(function (root) {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports
    ? require('./core.js') : root.__spxErrosEtiquetagemCore;
  const timezone = 'America/Sao_Paulo';
  const DAY = value => new Intl.DateTimeFormat('sv-SE', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
  const text = value => String(value == null ? '' : value).trim();
  const query = (path, data) => path + '?' + new URLSearchParams(data).toString();
  const isVT = value => /^VT\d{8}[A-Z0-9]+$/i.test(text(value));
  const limit = Object.freeze({taskPages:12, targetPages:15, parcelPages:15, parcelRequests:240, concurrency:3});

  function rowsOf(body) {
    const d = body?.data ?? body;
    return Array.isArray(d?.list) ? d.list : Array.isArray(d?.rows) ? d.rows : Array.isArray(d?.items) ? d.items : [];
  }
  function totalOf(body, fallback) {
    const d = body?.data ?? body;
    const total = Number(d?.total);
    return Number.isFinite(total) && total >= 0 ? total : fallback;
  }

  function parseTask(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const candidates = [row.validation_task_id,row.validation_task_number,row.task_number,row.task_id,row.vt_id,row.id,
      ...Object.values(row).filter(value => typeof value === 'string')];
    const vt = candidates.map(text).find(isVT);
    if (!vt) return null;
    const keys = ['create_time','created_time','created_at','ctime','task_create_time',
      'creation_time','start_time','validation_start_time','start_timestamp'];
    let start = 0;
    for (const key of keys) {
      if (!row[key]) continue;
      start = core.timestamp(row[key]);
      if (start) break;
    }
    if (!start) {
      // A tarefa pode conter campos com nomes locais diferentes, mas só considerar
      // horários de criação/início. Nunca usar complete_time ou update_time.
      for (const [key, value] of Object.entries(row)) {
        if (!/(?:creat|inici|start|^ctime$)/i.test(key) || /(update|complete|finish|end)/i.test(key)) continue;
        start = core.timestamp(value);
        if (start) break;
      }
    }
    return {vt:vt.toUpperCase(),start,day:start ? DAY(new Date(start)) : '',
      stationId:text(row.station_id ?? row.stationId ?? '')};
  }

  function assignShifts(raw, day, stationId = '') {
    const found = new Map();
    for (const record of raw) {
      const item = parseTask(record);
      if (!item || item.day !== day) continue;
      if (stationId && item.stationId && item.stationId !== text(stationId)) continue;
      if (!found.has(item.vt) || item.start < found.get(item.vt).start) found.set(item.vt,item);
    }
    const vts = [...found.values()].sort((a,b)=>a.start-b.start || a.vt.localeCompare(b.vt));
    return vts.map((item,index)=>({...item,shift:index===0?'AM':index===1?'PM':'PM'+index}));
  }

  async function discoverVts(day, request, progress = () => {}, cancelled = () => false, stationId = '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Data da conferência inválida.');
    const paths=['/api/in-station/lmhub/audit/task/list','/api/in-station/lmhub/audit/validation_task/list'];
    let lastError=null, incomplete=false;
    const attempts=[];
    let best=null;
    for (const path of paths) {
      for (const key of ['pageno','page_no']) {
        const records=[], seenPages=new Set();
        let error='';
        try {
          for (let page=1;page<=limit.taskPages;page++) {
            if (cancelled()) return {vts:[],cancelled:true};
            progress(`Procurando tarefas VT (${page}/${limit.taskPages})…`);
            const body=await request(query(path,{[key]:page,count:50}));
            const list=rowsOf(body);
            if (!list.length) break;
            const signature=list.map(item=>text(item.task_number ?? item.validation_task_id ?? item.task_id ?? item.id)).join('|');
            if (seenPages.has(signature)) throw new Error('Paginação VT repetiu a página.');
            seenPages.add(signature);
            records.push(...list);
            const total=totalOf(body,0);
            if (total ? records.length>=total : list.length<50) break;
            if (page===limit.taskPages) incomplete=true;
          }
          const found=assignShifts(records,day,stationId);
          const sampleDays=[...new Set(records.slice(0,100).map(r=>parseTask(r)?.day).filter(Boolean))].slice(0,8);
          attempts.push({source:path,pageParam:key,rows:records.length,matchedVts:found.length,
            fieldKeys:records[0] ? Object.keys(records[0]).slice(0,24) : [],sampleDays});
          if(!best || found.length>best.vts.length) best={vts:found,scannedTasks:records.length};
          // A primeira busca que encontrou VTs para a DATA informada é suficiente.
          if(found.length) return {...best,incomplete,diagnostics:{attempts}};
        } catch(e) {
          lastError=e;
          error=String(e.message || e);
          attempts.push({source:path,pageParam:key,rows:records.length,error});
        }
      }
    }
    return {vts:best?.vts||[],incomplete,scannedTasks:best?.scannedTasks||0,
      error:lastError?.message || (!best?.scannedTasks ? 'Nenhuma VT encontrada.' : ''),
      diagnostics:{attempts}};
  }

  async function paged(path, params, request, maxPages, cancelled) {
    const out=[];
    for(let p=1;p<=maxPages;p++) {
      if (cancelled()) throw new Error('interrompido');
      const data=await request(query(path,{...params,page_no:p,count:100}));
      const list=rowsOf(data);
      out.push(...list);
      const total=totalOf(data,0);
      if (!list.length || (total ? out.length>=total : list.length<100)) return out;
      if (p===maxPages) throw new Error('Limite de páginas da VT atingido; varredura incompleta.');
    }
    return out;
  }

  function exceptionTypes(target) {
    const tasks=[];
    if(Number(target?.missing_qty ?? 0)>0) tasks.push('MISSING');
    if(Number(target?.missort_qty ?? 0)>0) tasks.push('MISSORTED');
    return tasks;
  }
  function isException(parcel, type) {
    const step=text(parcel?.next_step_action).toLowerCase();
    if(type==='MISSING') return Number(parcel?.validation_status)===5 || step.includes('find the order in missorted corridor/cage');
    return Number(parcel?.validation_status)===7 || step==='put into the correct corridor / cage';
  }
  function parcelParams(vt,targetId,type) {
    const common={validation_task_id:vt,target_id:targetId,audit_target_type:2};
    return type==='MISSING' ? {...common,result_list:'5,10',shipment_id:''} : {...common,parcel_scan_status:2};
  }

  // Cada BR é associado à 1ª VT que realmente contém sua ocorrência de exceção,
  // nunca a um turno calculado pela hora do recebimento.
  async function locateInVts(vts, wantedBrs, request, progress = () => {}, cancelled = () => false) {
    const wanted=new Set(wantedBrs.map(v=>text(v).toUpperCase()));
    const found=new Map(), issues=[];
    let requests=0,incomplete=false;
    const sorted=[...vts].sort((a,b)=>a.start-b.start);
    for (const vt of sorted) {
      if(cancelled()) return {found,issues,incomplete:true,cancelled:true};
      if(found.size===wanted.size) break;
      let targets=[];
      try {
        progress(`Consultando rotas da VT ${vt.vt} (${vt.shift})…`);
        targets=await paged('/api/in-station/lmhub/audit/target/list',{task_id:vt.vt},request,limit.targetPages,cancelled);
      } catch(error) {
        if(cancelled()) return {found,issues,incomplete:true,cancelled:true};
        issues.push({vt:vt.vt,stage:'target/list',error:String(error.message || error)});
        incomplete=true;continue;
      }
      const jobs=[];
      for(const target of targets) {
        const tid=text(target?.target_id);
        if (!tid) continue;
        for (const type of exceptionTypes(target)) jobs.push({vt,target,type,tid});
      }
      let next=0,processed=0;
      const worker=async()=>{
        while (next<jobs.length && !cancelled()) {
          if(found.size===wanted.size) return;
          if(requests>=limit.parcelRequests) {incomplete=true;return;}
          const job=jobs[next++];
          // Limite local para não sobrecarregar o SPX quando muitas rotas têm exceções.
          requests++;
          try {
            const list=await paged('/api/in-station/lmhub/audit/parcel/list',
              parcelParams(job.vt.vt,job.tid,job.type),request,limit.parcelPages,cancelled);
            for (const parcel of list) {
              if(!isException(parcel,job.type)) continue;
              const br=text(parcel?.shipment_id).toUpperCase();
              if(!wanted.has(br) || found.has(br)) continue;
              found.set(br,{vt:job.vt.vt,shift:job.vt.shift,
                auditAt:job.vt.start,at:job.tid,lane:text(job.target.binding_entity)});
            }
          } catch(error) {
            if(cancelled()) return;
            issues.push({vt:job.vt.vt,stage:'parcel/list',error:String(error.message || error)});
            incomplete=true;
          }
          processed++;
          progress(`Conferência ${job.vt.shift}: ${processed}/${jobs.length} rotas de exceção · ${found.size}/${wanted.size} BRs localizados`);
        }
      };
      await Promise.all(Array.from({length:Math.min(limit.concurrency,jobs.length)},worker));
      if (requests>=limit.parcelRequests && found.size<wanted.size) incomplete=true;
    }
    return {found,issues,incomplete,requests};
  }

  const api=Object.freeze({parseTask,assignShifts,discoverVts,locateInVts,isException,parcelParams,rowsOf,limit});
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.__spxErrosEtiquetagemAudit=api;
})(globalThis);
