// Inject the MAIN world script to hook storage methods
try {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
} catch (e) {
  console.error('[StorageVault] Failed to inject storage interceptor:', e);
}

// Forward storage changes from MAIN world to the extension
window.addEventListener('__storage_vault_change__', (event) => {
  chrome.runtime.sendMessage({
    type: 'STORAGE_CHANGE',
    data: event.detail
  }).catch(() => {
    // Ignore error when extension popup or options page is not active
  });
});

// Listen for messages from popup / options dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, storageType, key, value } = message;

  if (type === 'GET_PAGE_STORAGE') {
    try {
      const local = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        local[k] = window.localStorage.getItem(k);
      }

      const session = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        session[k] = window.sessionStorage.getItem(k);
      }

      sendResponse({
        success: true,
        localStorage: local,
        sessionStorage: session,
        location: window.location.href,
        title: document.title
      });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  } 
  
  else if (type === 'SET_STORAGE_ITEM') {
    try {
      const targetStorage = storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
      targetStorage.setItem(key, value);
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  } 
  
  else if (type === 'REMOVE_STORAGE_ITEM') {
    try {
      const targetStorage = storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
      targetStorage.removeItem(key);
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  } 
  
  else if (type === 'CLEAR_STORAGE') {
    try {
      const targetStorage = storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
      targetStorage.clear();
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }

  return true; // Keep message channel open for async response
});
