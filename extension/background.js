'use strict';
const SPX = /^https:\/\/spx\.shopee\.com\.br\//i;

chrome.action.onClicked.addListener(async tab => {
  if (!tab?.id) return;
  if (!SPX.test(tab.url || '')) {
    await chrome.action.setBadgeBackgroundColor({tabId: tab.id, color: '#b45309'});
    await chrome.action.setBadgeText({tabId: tab.id, text: '!'});
    await chrome.action.setTitle({tabId: tab.id, title: 'Abra uma aba do SPX antes de usar ETQ.'});
    return;
  }
  try {
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['core.js', 'audit.js', 'page.js'], world: 'MAIN'});
    const response = await chrome.scripting.executeScript({
      target: {tabId: tab.id}, world: 'MAIN',
      func: () => window.__spxErrosEtiquetagemApp?.toggle() || {opened: false}
    });
    const open = !!response?.[0]?.result?.opened;
    await chrome.action.setBadgeBackgroundColor({tabId: tab.id, color: '#ea580c'});
    await chrome.action.setBadgeText({tabId: tab.id, text: ''});
    await chrome.action.setTitle({tabId: tab.id, title: 'ETQ — Abrir ou ocultar o ranking'});
  } catch (error) {
    await chrome.action.setBadgeBackgroundColor({tabId: tab.id, color: '#991b1b'});
    await chrome.action.setBadgeText({tabId: tab.id, text: '!'});
    console.error('ETQ:', error);
  }
});