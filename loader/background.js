'use strict';

// Carregador ETQ: semelhante ao SPX OnHold. Nenhuma lista de BR é enviada ao GitHub.
const CATALOG_URL = 'https://raw.githubusercontent.com/RAlDE/spx-erros-etiquetagem/main/catalog.json';
const SCRIPT_BASE = 'https://raw.githubusercontent.com/RAlDE/spx-erros-etiquetagem/main/extension/';
const REQUIRED_SCRIPTS = ['core.js', 'audit.js', 'page.js'];
const SCRIPT_ID = 'spx-etq:ranking';
const ENABLED_KEY = 'etq-loader:enabled';
const CACHED_JS_KEY = 'etq-loader:module-source';
const MODULE_VERSION_KEY = 'etq-loader:module-version';
const LAST_SYNC_KEY = 'etq-loader:last-sync';
const SPX_URL = /^https:\/\/spx\.shopee\.com\.br\//i;
let syncPromise = null;

const scriptsError = error => {
  const reason = String(error?.message || error || '');
  if (!chrome.userScripts || /user.?script|developer.?mode|permission/i.test(reason)) {
    return 'Abra chrome://extensions → ETQ → Detalhes e ative “Permitir scripts do usuário”. Depois clique em Atualizar.';
  }
  return reason || 'Não foi possível registrar o módulo ETQ.';
};

async function assertUserScripts() {
  if (!chrome.userScripts) throw new Error('Permissão de scripts de usuário não habilitada.');
  await chrome.userScripts.getScripts();
}

async function fetchNoCache(url) {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {cache: 'no-store'});
  if (!res.ok) throw new Error(`GitHub indisponível para ${url.split('/').pop()} (HTTP ${res.status}). Verifique se o repositório ETQ está público.`);
  return res;
}

function validateCatalog(payload) {
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.modules)) throw new Error('Catálogo ETQ inválido.');
  const module = payload.modules.find(item => item?.id === 'etq-ranking' && item.enabled === true);
  if (!module || !/^\d+\.\d+\.\d+$/.test(module.version || '')) throw new Error('Módulo ETQ indisponível no catálogo.');
  if (!Array.isArray(module.scripts) || module.scripts.length !== REQUIRED_SCRIPTS.length ||
      REQUIRED_SCRIPTS.some((file, i) => module.scripts[i] !== SCRIPT_BASE + file)) {
    throw new Error('Endereços do catálogo diferentes dos três módulos ETQ autorizados.');
  }
  return module;
}

async function downloadModule() {
  const catalog = await (await fetchNoCache(CATALOG_URL)).json();
  const module = validateCatalog(catalog);
  const codes = await Promise.all(module.scripts.map(async url => (await fetchNoCache(url)).text()));
  const signatures = ['__spxErrosEtiquetagemCore', '__spxErrosEtiquetagemAudit', '__spxErrosEtiquetagemApp'];
  for (let i = 0; i < codes.length; i++) {
    if (!codes[i].includes(signatures[i]) || codes[i].length < 200) {
      throw new Error(`Arquivo ${REQUIRED_SCRIPTS[i]} incompleto no GitHub.`);
    }
  }
  return {codes, moduleVersion: module.version};
}

async function registered() {
  await assertUserScripts();
  return (await chrome.userScripts.getScripts({ids: [SCRIPT_ID]})).some(x => x.id === SCRIPT_ID);
}

async function synchronize() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    await assertUserScripts();
    // Baixa e verifica TODOS os arquivos antes de modificar o registro anterior.
    const {codes, moduleVersion} = await downloadModule();
    const old = await chrome.userScripts.getScripts({ids: [SCRIPT_ID]});
    const previousCache = await chrome.storage.local.get({[CACHED_JS_KEY]: []});
    const previousCodes = previousCache[CACHED_JS_KEY];
    const registration = source => ({
      id: SCRIPT_ID,
      matches: ['https://spx.shopee.com.br/*'],
      js: source.map(code => ({code})),
      runAt: 'document_idle',
      world: 'MAIN',
      allFrames: false
    });
    if (old.length) await chrome.userScripts.unregister({ids: [SCRIPT_ID]});
    try {
      await chrome.userScripts.register([registration(codes)]);
    } catch (error) {
      // Falha na versão nova: tentar restaurar a última versão funcional.
      if (old.length && Array.isArray(previousCodes) && previousCodes.length === 3) {
        try {await chrome.userScripts.register([registration(previousCodes)]);}
        catch (restoreError) {console.error('[ETQ Loader] Não foi possível restaurar versão anterior:', restoreError);}
      }
      throw new Error('Não foi possível ativar o novo módulo: ' + String(error?.message || error));
    }
    // Cache SOMENTE do código público, para abrir em uma aba SPX já carregada.
    await chrome.storage.local.set({
      [CACHED_JS_KEY]: codes,
      [MODULE_VERSION_KEY]: moduleVersion,
      [LAST_SYNC_KEY]: Date.now(),
      [ENABLED_KEY]: true
    });
    return {ok: true, version: moduleVersion};
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}

async function setEnabled(enabled) {
  await assertUserScripts();
  if (!enabled) {
    const items = await chrome.userScripts.getScripts({ids: [SCRIPT_ID]});
    if (items.length) await chrome.userScripts.unregister({ids: [SCRIPT_ID]});
    await chrome.storage.local.set({[ENABLED_KEY]: false});
    return {ok: true, enabled: false};
  }
  const result = await synchronize();
  return {...result, enabled: true};
}

async function getStatus() {
  const data = await chrome.storage.local.get({
    [ENABLED_KEY]: true,
    [MODULE_VERSION_KEY]: '',
    [LAST_SYNC_KEY]: 0
  });
  let ready = false, issue = '';
  try {ready = await registered();}
  catch (error) {issue = scriptsError(error);}
  return {
    ok: true,
    enabled: data[ENABLED_KEY] === true,
    registered: ready,
    version: data[MODULE_VERSION_KEY],
    lastSync: data[LAST_SYNC_KEY],
    issue
  };
}

async function openPanel() {
  await assertUserScripts();
  const { [ENABLED_KEY]: enabled, [CACHED_JS_KEY]: codes } = await chrome.storage.local.get({
    [ENABLED_KEY]: true, [CACHED_JS_KEY]: []
  });
  if (!enabled) throw new Error('A ETQ está desativada. Clique em Ativar.');
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  const tab = tabs.find(t => Number.isInteger(t.id) && SPX_URL.test(t.url || ''));
  if (!tab) throw new Error('Abra uma aba do SPX para visualizar a ETQ.');
  if (!Array.isArray(codes) || codes.length !== 3) throw new Error('Clique em Atualizar pelo GitHub para carregar os módulos ETQ.');

  // Injeta também na aba que já estava aberta antes da atualização.
  // As proteções no início dos módulos evitam múltiplos painéis no mesmo documento.
  // Uma única execução garante que o resultado retornado é o do toggle,
  // mesmo quando a página ainda não tinha os módulos previamente carregados.
  const source = codes.join('\n;\n') + '\n;\nwindow.__spxErrosEtiquetagemApp?.toggle() || {opened:false};';
  const response = await chrome.userScripts.execute({
    target: {tabId: tab.id}, js: [{code: source}], world: 'MAIN', injectImmediately: true
  });
  const errors = response.filter(x => x.error).map(x => x.error);
  if (errors.length) throw new Error(errors[0]);
  const opened = response[0]?.result?.opened;
  if (typeof opened !== 'boolean') throw new Error('Painel ETQ não inicializou. Recarregue a página do SPX e tente novamente.');
  return {ok: true, opened};
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({[ENABLED_KEY]: true}).then(state => {
    if (state[ENABLED_KEY]) return synchronize();
  }).catch(error => console.warn('[ETQ Loader]', scriptsError(error)));
});
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({[ENABLED_KEY]: true}).then(state => {
    if (state[ENABLED_KEY]) return synchronize();
  }).catch(error => console.warn('[ETQ Loader]', scriptsError(error)));
});
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const actions = {
    STATUS: getStatus,
    SYNC: synchronize,
    TOGGLE_ENABLED: () => setEnabled(msg.enabled === true),
    OPEN_PANEL: openPanel
  };
  if (!msg || !Object.prototype.hasOwnProperty.call(actions, msg.type)) return false;
  actions[msg.type]().then(sendResponse).catch(error => sendResponse({ok: false, error: scriptsError(error)}));
  return true;
});
