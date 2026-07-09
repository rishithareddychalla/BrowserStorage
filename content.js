// The MAIN world script (inject.js) is injected natively by the extension manifest,
// which avoids cross-origin/unique security origin warnings on file:/// pages.

// Forward storage changes from MAIN world to the extension
window.addEventListener('__storage_vault_change__', (event) => {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    chrome.runtime.sendMessage({
      type: 'STORAGE_CHANGE',
      data: event.detail
    }).catch(() => {
      // Ignore error when extension popup or options page is not active
    });
  }
});

// Listen for messages from popup / options dashboard
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, storageType, key, value } = message;

  if (type === 'GET_PAGE_STORAGE') {
    (async () => {
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

        // Fetch IndexedDB database stores and records
        const indexedData = {};
        if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
          try {
            const dbs = await indexedDB.databases();
            for (const dbInfo of dbs) {
              const dbName = dbInfo.name;
              if (!dbName) continue;
              
              const db = await new Promise((resolve) => {
                const req = indexedDB.open(dbName);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
              });

              if (db) {
                const stores = Array.from(db.objectStoreNames);
                for (const storeName of stores) {
                  const records = await new Promise((resolve) => {
                    try {
                      const tx = db.transaction(storeName, 'readonly');
                      const store = tx.objectStore(storeName);
                      const getReq = store.getAll(null, 50); // limit 50 records for display size
                      getReq.onsuccess = () => resolve(getReq.result);
                      getReq.onerror = () => resolve([]);
                    } catch (e) {
                      resolve([]);
                    }
                  });
                  const compoundKey = `${dbName} :: ${storeName}`;
                  indexedData[compoundKey] = JSON.stringify(records, null, 2);
                }
                db.close();
              }
            }
          } catch (err) {
            console.error('[StorageVault] IndexedDB extraction error:', err);
          }
        }

        sendResponse({
          success: true,
          localStorage: local,
          sessionStorage: session,
          indexedDB: indexedData,
          location: window.location.href,
          title: document.title
        });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; // Keep message channel open for async response
  } 
  
  else if (type === 'SET_STORAGE_ITEM') {
    if (storageType === 'indexedDB') {
      (async () => {
        try {
          const parts = key.split(' :: ');
          if (parts.length === 2) {
            const [dbName, storeName] = parts;
            let records;
            try {
              records = JSON.parse(value);
              if (!Array.isArray(records)) {
                sendResponse({ success: false, error: 'Value must be a JSON array of records' });
                return;
              }
            } catch (e) {
              sendResponse({ success: false, error: 'Malformed JSON: ' + e.message });
              return;
            }

            const success = await new Promise((resolve) => {
              const req = indexedDB.open(dbName);
              req.onsuccess = (e) => {
                const db = e.target.result;
                try {
                  const tx = db.transaction(storeName, 'readwrite');
                  const store = tx.objectStore(storeName);
                  const clearReq = store.clear();
                  
                  clearReq.onsuccess = () => {
                    if (records.length === 0) {
                      db.close();
                      resolve(true);
                      return;
                    }
                    let count = 0;
                    let hasError = false;
                    records.forEach(rec => {
                      try {
                        const putReq = store.put(rec);
                        putReq.onsuccess = () => {
                          count++;
                          if (count === records.length && !hasError) {
                            db.close();
                            resolve(true);
                          }
                        };
                        putReq.onerror = () => {
                          hasError = true;
                        };
                      } catch (err) {
                        hasError = true;
                      }
                    });
                    tx.onerror = () => {
                      db.close();
                      resolve(false);
                    };
                  };
                  clearReq.onerror = () => {
                    db.close();
                    resolve(false);
                  };
                } catch (err) {
                  db.close();
                  resolve(false);
                }
              };
              req.onerror = () => resolve(false);
            });
            sendResponse({ success });
          } else {
            sendResponse({ success: false, error: 'Malformed key' });
          }
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    } else {
      try {
        const targetStorage = storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
        targetStorage.setItem(key, value);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return false;
    }
  } 

  
  else if (type === 'REMOVE_STORAGE_ITEM') {
    if (storageType === 'indexedDB') {
      (async () => {
        try {
          const parts = key.split(' :: ');
          if (parts.length === 2) {
            const [dbName, storeName] = parts;
            const success = await new Promise((resolve) => {
              const req = indexedDB.open(dbName);
              req.onsuccess = (e) => {
                const db = e.target.result;
                try {
                  const tx = db.transaction(storeName, 'readwrite');
                  const store = tx.objectStore(storeName);
                  const clearReq = store.clear();
                  clearReq.onsuccess = () => {
                    db.close();
                    resolve(true);
                  };
                  clearReq.onerror = () => {
                    db.close();
                    resolve(false);
                  };
                } catch (err) {
                  db.close();
                  resolve(false);
                }
              };
              req.onerror = () => resolve(false);
            });
            sendResponse({ success });
          } else {
            sendResponse({ success: false, error: 'Malformed key' });
          }
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true; // Async response
    } else {
      try {
        const targetStorage = storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
        targetStorage.removeItem(key);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return false;
    }
  } 
  
  else if (type === 'CLEAR_STORAGE') {
    if (storageType === 'indexedDB') {
      (async () => {
        try {
          if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
            const dbs = await indexedDB.databases();
            for (const dbInfo of dbs) {
              const dbName = dbInfo.name;
              if (dbName) {
                await new Promise((resolve) => {
                  const req = indexedDB.deleteDatabase(dbName);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                });
              }
            }
          }
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    } else {
      try {
        const targetStorage = storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
        targetStorage.clear();
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return false;
    }
  }

  return false;
});
}
