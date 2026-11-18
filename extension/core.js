/* SPX Erros de Etiquetagem — lógica determinística, sem I/O e sem persistência. */
(function (root) {
  'use strict';

  const text = value => String(value == null ? '' : value).trim();
  const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();

  function parseBrs(input) {
    const words = String(input || '').toUpperCase().match(/[\p{L}\p{N}_]+/gu) || [];
    return [...new Set(words.filter(word => /^BR[A-Z0-9]{8,}$/.test(word) && /\d/.test(word)))];
  }

  function timestamp(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(text(value))) {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return 0;
      const milliseconds = n > 1e11 ? n : n > 1e9 ? n * 1000 : 0;
      return milliseconds > Date.UTC(2000, 0, 1) && milliseconds < Date.UTC(2100, 0, 1) ? milliseconds : 0;
    }
    const formatted = text(value).replace(' ', 'T');
    const n = Date.parse(formatted);
    return Number.isFinite(n) && n > Date.UTC(2000, 0, 1) && n < Date.UTC(2100, 0, 1) ? n : 0;
  }

  function eventTime(event) {
    for (const key of ['timestamp', 'ctime', 'event_time', 'eventTime', 'create_time', 'created_at', 'created_time', 'occurred_at', 'datetime', 'date_time', 'time', 'date']) {
      const value = timestamp(event?.[key]);
      if (value) return value;
    }
    return 0;
  }

  function collectObjects(rootObject) {
    const found = [], seen = new WeakSet();
    function walk(value, depth) {
      if (!value || typeof value !== 'object' || depth > 14 || seen.has(value) || found.length >= 40000) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(child => walk(child, depth + 1));
        return;
      }
      found.push(value);
      Object.values(value).forEach(child => walk(child, depth + 1));
    }
    walk(rootObject, 0);
    return found;
  }

  function eventLabels(event) {
    const fields = ['status', 'status_name', 'statusName', 'status_desc', 'status_description',
      'statusDescription', 'state', 'state_name', 'event', 'event_name', 'eventName', 'event_code',
      'eventCode', 'title', 'tracking_status', 'tracking_status_name', 'trackingStatus', 'trackingStatusName'];
    return fields.map(key => event?.[key]).filter(v => typeof v === 'string' && text(v)).map(normalize);
  }

  function isReceived(event) {
    if (!event || typeof event !== 'object') return false;
    // Referência conferida no código LMH Audit 2.9.0: status 1 = recebimento normal,
    // status 10 = recebimento Return. Status numérico não aparece em eventLabels 0.1.1.
    const status = text(event.status);
    if (status === '10' || status === '125') return false;
    if (status === '1') return true;
    const labels = eventLabels(event);
    if (labels.some(v => /^(?:return|retorno)[_\s-]/.test(v))) return false;
    if (labels.some(v => ['lmhub_recebido', 'lmhub_received', 'lm_hub_recebido',
      'lm_hub_received', 'last_mile_hub_received'].includes(v))) return true;
    const message = normalize([event.message, event.description, event.remark, event.title].filter(Boolean).join(' '));
    return /^pedido_chegou_ao_last_mile_hub_para_entrega(?:_|$)/.test(message) ||
      /(?:^|_)lm_?hub_recebid[oa](?:_|$)/.test(message) ||
      /(?:^|_)lm_?hub_received(?:_|$)/.test(message);
  }

  function isAssignment(event) {
    const names = eventLabels(event);
    const explicit = names.some(value => ['lmhub_atribuindo', 'lmhub_assigning', 'lmhub_assigned', 'lm_hub_atribuindo'].includes(value));
    const message = [event?.message, event?.description].map(text).join(' ');
    return explicit || /\bAssignment\s+Task\b/i.test(message);
  }

  function normalizeOpsId(value) {
    const m = text(value).match(/^(?:Ops)?(\d+)$/i);
    return m ? 'Ops' + m[1] : '';
  }

  function parseOperator(event) {
    if (!event || typeof event !== 'object') return null;
    const names = [event?.operator_name, event?.operatorName, event?.operator_login,
      event?.user_name, event?.staff_name, event?.biz_staff_name, event?.login]
      .map(text).filter(Boolean);
    const candidates = [event.operator, event.operator_info, event.operatorInfo,
      event.operation_user, event.operate_user, event.user, event.biz_staff_name,
      event.staff_name, event.operatorName];
    for (const item of candidates) {
      if (typeof item === 'string') {
        // Formatos SPX [Ops131849] NOME e [131849] NOME (LMH Audit).
        const match = item.match(/^\s*\[\s*(?:Ops)?(\d+)\s*\]\s*(.*?)\s*$/i);
        if (match) return {ops: 'Ops' + match[1], name: text(match[2]) || names[0] || 'Nome não informado'};
        const solo = normalizeOpsId(item);
        if (solo) return {ops: solo, name: names[0] || 'Nome não informado'};
      } else if (item && typeof item === 'object' && !Array.isArray(item)) {
        const id = normalizeOpsId(item.ops_id ?? item.operator_id ?? item.id ?? item.user_id ?? item.staff_id);
        if (id) return {ops: id, name: text(item.operator_name || item.user_name || item.name || item.login) || names[0] || 'Nome não informado'};
      }
    }
    const id = [event?.operator_id, event?.ops_id, event?.user_id, event?.staff_id]
      .map(normalizeOpsId).find(Boolean);
    return id ? {ops: id, name: names[0] || 'Nome não informado'} : null;
  }

  function sanitizedEventDiagnostic(events) {
    const counts = {};
    for (const e of events) {
      const key = e.item?.status == null ? '(ausente)' : typeof e.item.status === 'number' || /^\d+$/.test(text(e.item.status)) ? String(e.item.status) : '(texto)';
      counts[key] = (counts[key] || 0) + 1;
    }
    // Não exportar nomes, logins, mensagens individuais ou respostas SPX brutas.
    return {objects: events.length, statusCounts: counts,
      eventFieldSamples: [...new Set(events.flatMap(e => Object.keys(e.item)).filter(k => /status|event|operator|staff|time|station|message|desc|remark/i.test(k)))].slice(0, 24)};
  }

  function extractAt(event) {
    const structured = [event?.assignment_task_id, event?.assignmentTaskId, event?.assignment?.assignment_task_id, event?.assignment_task?.id]
      .map(text).find(value => /^AT[A-Z0-9]{6,}$/i.test(value));
    if (structured) return structured.toUpperCase();
    const message = [event?.message, event?.description].map(text).join(' ');
    const match = message.match(/\bAssignment\s+Task\s*\[?\s*(AT[A-Z0-9]{6,})\s*\]?/i);
    return match ? match[1].toUpperCase() : '';
  }

  function summarizeTracking(payload, options = {}) {
    const objects = collectObjects(payload?.data?.tracking_list || payload?.data?.trackingList || payload);
    const events = objects.map((item, index) => ({item, index, at: eventTime(item)}));
    const station = text(options.stationId);
    const received = events.filter(e => isReceived(e.item) &&
      (!station || !text(e.item.station_id ?? e.item.stationId) ||
       text(e.item.station_id ?? e.item.stationId) === station));
    const diagnostic = sanitizedEventDiagnostic(events);
    if (!received.length) {
      return {ok:false, reason:'recebimento_nao_identificado', diagnostic};
    }
    if (received.some(e => !e.at)) {
      return {ok:false, reason:'horario_recebimento_indeterminado', diagnostic:{...diagnostic,receivedCount:received.length}};
    }
    received.sort((a, b) => b.at - a.at || b.index - a.index);
    const latestAt = received[0].at;
    const latestGroup = received.filter(e => e.at === latestAt);
    const operators = latestGroup.map(e => parseOperator(e.item)).filter(Boolean);
    const ids = [...new Set(operators.map(o => o.ops.toUpperCase()))];
    if (ids.length > 1) return {ok:false,reason:'operadores_conflitantes_mesmo_horario',diagnostic:{receivedCount:received.length}};
    const operator = operators.find(o => o.name !== 'Nome não informado') || operators[0];
    if (!operator) return {ok:false,reason:'ops_nao_identificado',receivedAt:latestAt,
      diagnostic:{...diagnostic,receivedCount:received.length}};

    // A AT do mesmo ciclo é opcional, apenas posterior a este recebimento.
    const assignment = events.filter(e => isAssignment(e.item) && e.at >= latestAt &&
      e.at - latestAt <= 6 * 3600 * 1000 && extractAt(e.item))
      .sort((a,b) => a.at - b.at || a.index - b.index)[0];
    return {ok:true,ops:operator.ops,name:operator.name,receivedAt:latestAt,
      assignmentId:assignment ? extractAt(assignment.item) : '',
      diagnostic:{receivedCount:received.length}};
  }

  // Fallback via Gestão de Recebimento: só se o MESMO BR e o horário do último
  // recebimento do rastreamento forem confirmados. Nunca aceitar primeira linha às cegas.
  function confirmReceiveTask(payload, br, latestAt, toleranceMs = 10 * 60 * 1000) {
    const rows = assignmentCandidates(payload);
    const wanted = text(br).toUpperCase();
    const matches = rows.filter(row => {
      const id = text(row.shipment_id || row.spx_tracking_number || row.tracking_number || row.shipmentId).toUpperCase();
      const at = timestamp(row.complete_time ?? row.received_time ?? row.received_at ?? row.ctime);
      return id === wanted && at && Math.abs(at - latestAt) <= toleranceMs;
    });
    const distinct = new Map();
    for (const item of matches) {
      const operator = parseOperator(item);
      if (operator) distinct.set(operator.ops.toUpperCase(), operator);
    }
    if (distinct.size !== 1) return {ok:false,reason:matches.length ? 'recebimento_sem_ops_confiavel' : 'tarefa_sem_correspondencia_temporal'};
    return {ok:true,...[...distinct.values()][0]};
  }

  function assignmentCandidates(response) {
    const data = response?.data ?? response;
    const buckets = [data?.list, data?.rows, data?.items, data?.data, response?.list, response?.rows];
    return buckets.filter(Array.isArray).flat().filter(item => item && typeof item === 'object');
  }

  function flatFields(object) {
    const values = [], seen = new WeakSet();
    function walk(node, path, depth) {
      if (!node || typeof node !== 'object' || depth > 7 || seen.has(node)) return;
      seen.add(node);
      Object.entries(node).forEach(([key, value]) => {
        const next = path.concat(key);
        if (value && typeof value === 'object') walk(value, next, depth + 1);
        else if (typeof value === 'string' || typeof value === 'number') values.push({path: normalize(next.join(' ')), key: normalize(key), value: text(value)});
      });
    }
    walk(object, [], 0);
    return values;
  }

  function extractLane(response, assignmentId) {
    const key = text(assignmentId).toUpperCase();
    const rows = assignmentCandidates(response);
    const located = rows.map(row => ({row, fields: flatFields(row)})).filter(x =>
      x.fields.some(f => ['assignment_task_id', 'assignment_id', 'id_da_at', 'at_id'].includes(f.key) && f.value.toUpperCase() === key)
    );
    if (located.length !== 1) return {ok: false, reason: located.length ? 'at_ambigua' : 'at_nao_encontrada'};
    const matches = located[0].fields.filter(f =>
      /(?:corredor|gaiola|corridor|cage)/.test(f.path) &&
      /^(?:[A-Z]{1,3}[-\s]?\d{1,4}|[A-Z]{1,3}-[A-Z0-9]{1,8})$/i.test(f.value)
    );
    const distinct = [...new Set(matches.map(f => f.value.toUpperCase().replace(/\s+/g, '')))];
    return distinct.length === 1 ? {ok:true,lane:distinct[0]} : {ok:false,reason: distinct.length ? 'rua_ambigua' : 'rua_nao_identificada'};
  }

  function buildRanking(results, mode = 'GERAL') {
    const byOps = new Map(), unknown = [], seen = new Set();
    let unclassified = 0, allKnown = 0;
    const wanted = text(mode).toUpperCase();
    for (const result of results) {
      const br = text(result?.br).toUpperCase();
      if (!br || seen.has(br)) continue;
      seen.add(br);
      if (!result?.ok || !result?.ops) {unknown.push(result);continue;}
      allKnown += 1;
      if (!result.shift) unclassified += 1;
      if (wanted !== 'GERAL' && wanted !== text(result.shift).toUpperCase()) continue;
      const id = text(result.ops).toUpperCase();
      if (!byOps.has(id)) byOps.set(id,{ops:result.ops,name:result.name,count:0,brs:[],details:[]});
      const item = byOps.get(id);
      if (item.name === 'Nome não informado' && result.name !== 'Nome não informado') item.name = result.name;
      item.count += 1;
      item.brs.push(result.br);
      item.details.push({br:result.br,receivedAt:result.receivedAt,
        assignmentId:result.assignmentId || '',lane:result.lane || '',vt:result.vt || '',shift:result.shift || ''});
    }
    const ranking = [...byOps.values()].sort((a,b)=>b.count-a.count || a.ops.localeCompare(b.ops,'pt-BR'));
    return {ranking,unknown,counted:ranking.reduce((n,r)=>n+r.count,0),allKnown,unclassified};
  }

  const api = Object.freeze({parseBrs,normalize,timestamp,eventTime,isReceived,parseOperator,extractAt,
    summarizeTracking,confirmReceiveTask,extractLane,buildRanking});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.__spxErrosEtiquetagemCore = api;
})(globalThis);
