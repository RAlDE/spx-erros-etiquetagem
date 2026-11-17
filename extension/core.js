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
    const fields = ['status', 'status_name', 'statusName', 'status_desc', 'status_description', 'statusDescription', 'state', 'state_name', 'event', 'event_name', 'eventName', 'event_code', 'eventCode', 'title', 'tracking_status', 'tracking_status_name', 'trackingStatus', 'trackingStatusName'];
    const values = fields.map(key => event?.[key]).filter(v => typeof v === 'string' && text(v));
    return values.map(normalize);
  }

  function isReceived(event) {
    return eventLabels(event).some(value => value === 'lmhub_recebido' || value === 'lmhub_received' || value === 'lm_hub_recebido' || value === 'lm_hub_received');
  }

  function isAssignment(event) {
    const names = eventLabels(event);
    const explicit = names.some(value => ['lmhub_atribuindo', 'lmhub_assigning', 'lmhub_assigned', 'lm_hub_atribuindo'].includes(value));
    const message = [event?.message, event?.description].map(text).join(' ');
    return explicit || /\bAssignment\s+Task\b/i.test(message);
  }

  function parseOperator(event) {
    const candidates = [event?.operator, event?.operator_info, event?.operatorInfo, event?.operation_user, event?.operate_user, event?.user];
    let id = '', name = '';
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const match = candidate.match(/\[\s*(Ops\d+)\s*\]\s*([^\[\]]*)/i);
        if (match) {
          id = match[1].replace(/^ops/i, 'Ops');
          name = text(match[2]);
          break;
        }
      } else if (candidate && typeof candidate === 'object') {
        const cid = text(candidate.ops_id || candidate.operator_id || candidate.id || candidate.user_id);
        const cname = text(candidate.operator_name || candidate.user_name || candidate.name || candidate.login);
        if (/^Ops\d+$/i.test(cid)) {
          id = cid.replace(/^ops/i, 'Ops');
          name = cname;
          break;
        }
      }
    }
    if (!id) {
      const rawId = [event?.operator_id, event?.ops_id, event?.user_id].map(text).find(val => /^Ops\d+$/i.test(val));
      if (rawId) {
        id = rawId.replace(/^ops/i, 'Ops');
        name = text(event?.operator_name || event?.operator_login || event?.user_name || event?.login);
      }
    }
    return id ? {ops: id, name: name || 'Nome não informado'} : null;
  }

  function extractAt(event) {
    const structured = [event?.assignment_task_id, event?.assignmentTaskId, event?.assignment?.assignment_task_id, event?.assignment_task?.id]
      .map(text).find(value => /^AT[A-Z0-9]{6,}$/i.test(value));
    if (structured) return structured.toUpperCase();
    const message = [event?.message, event?.description].map(text).join(' ');
    const match = message.match(/\bAssignment\s+Task\s*\[?\s*(AT[A-Z0-9]{6,})\s*\]?/i);
    return match ? match[1].toUpperCase() : '';
  }

  function summarizeTracking(payload) {
    const objects = collectObjects(payload?.data?.tracking_list || payload?.data?.trackingList || payload);
    const events = objects.map((item, index) => ({item, index, at: eventTime(item), labels: eventLabels(item)}));
    const received = events.filter(e => isReceived(e.item));
    if (!received.length) {
      return {
        ok: false, reason: 'recebimento_nao_identificado',
        diagnostic: {objects: objects.length, statusSamples: [...new Set(events.flatMap(e => e.labels))].slice(0, 25)}
      };
    }
    if (received.some(e => !e.at)) {
      return {ok: false, reason: 'horario_recebimento_indeterminado', diagnostic: {receivedCount: received.length}};
    }
    received.sort((a, b) => b.at - a.at || b.index - a.index);
    if (received.length > 1 && received[0].at === received[1].at && JSON.stringify(parseOperator(received[0].item)) !== JSON.stringify(parseOperator(received[1].item))) {
      return {ok: false, reason: 'operadores_conflitantes_mesmo_horario', diagnostic: {receivedCount: received.length}};
    }
    const latest = received[0];
    const operator = parseOperator(latest.item);
    if (!operator) return {ok: false, reason: 'ops_nao_identificado', receivedAt: latest.at, diagnostic: {receivedCount: received.length}};

    // A AT é opcional: somente do primeiro evento de atribuição APÓS o recebimento.
    // Não carregar uma AT antiga de outra passagem/rota do mesmo BR.
    const assignment = events.filter(e => isAssignment(e.item) && e.at >= latest.at && e.at - latest.at <= 6 * 3600 * 1000 && extractAt(e.item))
      .sort((a, b) => a.at - b.at || a.index - b.index)[0];
    return {
      ok: true, ops: operator.ops, name: operator.name, receivedAt: latest.at,
      assignmentId: assignment ? extractAt(assignment.item) : '',
      diagnostic: {receivedCount: received.length}
    };
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

  function buildRanking(results) {
    const byOps = new Map();
    const unknown = [];
    for (const result of results) {
      if (!result?.ok || !result?.ops) {
        if (result) unknown.push(result);
        continue;
      }
      const id = text(result.ops).toUpperCase();
      if (!byOps.has(id)) byOps.set(id, {ops: result.ops, name: result.name, count: 0, brs: [], details: []});
      const item = byOps.get(id);
      if (item.name === 'Nome não informado' && result.name !== 'Nome não informado') item.name = result.name;
      item.count += 1;
      item.brs.push(result.br);
      item.details.push({br: result.br, receivedAt: result.receivedAt, assignmentId: result.assignmentId || '', lane: result.lane || ''});
    }
    const ranking = [...byOps.values()].sort((a, b) => b.count - a.count || a.ops.localeCompare(b.ops, 'pt-BR'));
    return {ranking, unknown, counted: ranking.reduce((n, r) => n + r.count, 0)};
  }

  const api = Object.freeze({parseBrs, normalize, timestamp, eventTime, isReceived, parseOperator, extractAt, summarizeTracking, extractLane, buildRanking});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.__spxErrosEtiquetagemCore = api;
})(globalThis);