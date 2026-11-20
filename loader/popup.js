'use strict';
const el = id => document.getElementById(id);
let busy = false;
let currentEnabled = true;

function send(type, extra = {}) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({type, ...extra}, response => {
      const err = chrome.runtime.lastError;
      resolve(err ? {ok:false,error:err.message} : (response || {ok:false,error:'Não houve resposta da extensão.'}));
    });
  });
}
function status(value) {el('status').textContent = value;}
function buttonsDisabled(value) {
  busy = value;
  for (const id of ['sync','open','toggle']) el(id).disabled = value;
}
async function refresh() {
  const response = await send('STATUS');
  if (!response.ok) return status(response.error || 'Erro ao consultar o carregador.');
  currentEnabled = response.enabled;
  el('version').textContent = response.version || 'Ainda não carregado';
  el('toggle').textContent = response.enabled ? 'Desativar ETQ' : 'Ativar ETQ';
  status(response.issue || (response.registered ? 'ETQ pronta. Abra o SPX e clique em Abrir.' : response.enabled ? 'Clique em Atualizar pelo GitHub.' : 'ETQ desativada.'));
}

el('sync').addEventListener('click', async () => {
  if (busy) return;
  buttonsDisabled(true);status('Baixando os módulos do GitHub…');
  const r = await send('SYNC');
  buttonsDisabled(false);
  if (!r.ok) return status(r.error || 'Falha ao atualizar.');
  await refresh();status(`Atualizado: ${r.version}. Recarregue a aba SPX para aplicar na página já aberta.`);
});
el('toggle').addEventListener('click', async () => {
  if (busy) return;
  buttonsDisabled(true);status(currentEnabled ? 'Desativando…' : 'Ativando…');
  const r = await send('TOGGLE_ENABLED', {enabled: !currentEnabled});
  buttonsDisabled(false);
  if (!r.ok) return status(r.error || 'Não foi possível alterar o estado.');
  await refresh();
});
el('open').addEventListener('click', async () => {
  if (busy) return;
  buttonsDisabled(true);status('Abrindo o painel no SPX…');
  const r = await send('OPEN_PANEL');
  buttonsDisabled(false);
  if (!r.ok) return status(r.error || 'Não foi possível abrir a ETQ.');
  window.close();
});
refresh();
