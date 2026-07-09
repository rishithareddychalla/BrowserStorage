// Popup QuickView Controller - StorageVault

// Safe mock for non-extension environments (e.g. direct HTML view)
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs) {
  window.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: (msg, cb) => {
        if (msg.type === 'GET_COOKIES') cb([]);
        else if (cb) cb({ success: true });
      },
      openOptionsPage: () => window.open('../options/options.html', '_blank')
    },
    tabs: {
      query: (query, cb) => {
        cb([
          { id: 1, url: 'https://example.com', title: 'Interactive Mock Workspace', active: true, favIconUrl: 'https://www.google.com/s2/favicons?domain=example.com' }
        ]);
      },
      sendMessage: (id, msg, cb) => {
        if (msg.type === 'GET_PAGE_STORAGE') {
          cb({
            success: true,
            localStorage: {
              'user_session_token': 'sk-proj-48charsofdummyopenaiapikeykeyvaluethatislong',
              'theme_mode': 'dark',
              'cart_items': '{"items":[{"id":102,"qty":2},{"id":405,"qty":1}]}',
              'jwt_auth_debug': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
            },
            sessionStorage: {
              'tab_session_id': 'sess_993847291a'
            }
          });
        } else {
          cb({ success: true });
        }
      }
    },
    cookies: {
      getAll: (query, cb) => {
        cb([
          { name: '_ga', value: 'GA1.2.192847192.12847291' },
          { name: 'session_id', value: 'c9f8d9b1e9c8' }
        ]);
      }
    }
  };
}

let activeTabId = null;
let activeTabUrl = '';
let popupStorageData = []; // unified list of items

const els = {
  btnOpenDashboard: document.getElementById('btn-open-dashboard'),
  btnDashboardMain: document.getElementById('btn-dashboard-main'),
  btnPopupRefresh: document.getElementById('btn-popup-refresh'),
  btnPopupAdd: document.getElementById('btn-popup-add'),
  
  siteFavicon: document.getElementById('site-favicon'),
  siteDomain: document.getElementById('site-domain'),
  siteStatus: document.getElementById('site-status'),
  
  statTotalCount: document.getElementById('stat-total-count'),
  statTotalSize: document.getElementById('stat-total-size'),
  
  segLocal: document.getElementById('seg-local'),
  segSession: document.getElementById('seg-session'),
  segCookie: document.getElementById('seg-cookie'),
  
  popupSearch: document.getElementById('popup-search'),
  itemsList: document.getElementById('items-list')
};

document.addEventListener('DOMContentLoaded', async () => {
  // Query active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      activeTabId = tab.id;
      activeTabUrl = tab.url;
      
      const domain = new URL(tab.url).hostname;
      els.siteDomain.textContent = domain;
      els.siteStatus.textContent = 'Connected';
      
      if (tab.favIconUrl) {
        els.siteFavicon.src = tab.favIconUrl;
        els.siteFavicon.classList.remove('hidden');
      }
      
      fetchData();
    } else {
      els.siteDomain.textContent = 'Extension/System Page';
      els.siteStatus.textContent = 'Inspections disabled';
      els.siteFavicon.classList.add('hidden');
      els.itemsList.innerHTML = '<li class="empty-state-small">Open a website tab to inspect its storage structure.</li>';
    }
  });

  // Navigation to dashboard
  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
  };
  
  els.btnOpenDashboard.onclick = openDashboard;
  els.btnDashboardMain.onclick = openDashboard;
  els.btnPopupAdd.onclick = openDashboard;

  els.btnPopupRefresh.onclick = () => {
    fetchData();
  };

  // Instant filter
  els.popupSearch.oninput = () => {
    renderItemsList();
  };
});

// Fetch storage and cookies
function fetchData() {
  if (!activeTabId) return;

  els.itemsList.innerHTML = '<li class="empty-state-small">Loading storage data...</li>';

  chrome.tabs.sendMessage(activeTabId, { type: 'GET_PAGE_STORAGE' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      // Fallback dynamic injection
      chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          showConnectionError();
        } else {
          // Try messaging again
          chrome.tabs.sendMessage(activeTabId, { type: 'GET_PAGE_STORAGE' }, (res) => {
            if (chrome.runtime.lastError || !res || !res.success) {
              showConnectionError();
            } else {
              getCookiesAndMerge(res);
            }
          });
        }
      });
    } else {
      getCookiesAndMerge(response);
    }
  });

  function showConnectionError() {
    els.itemsList.innerHTML = '<li class="empty-state-small" style="color: var(--color-danger)">Unable to sync. Reload the page and try again.</li>';
    els.siteStatus.textContent = 'Error';
  }

  function getCookiesAndMerge(webStorageResponse) {
    chrome.cookies.getAll({ url: activeTabUrl }, (cookies) => {
      mergeStorageData(webStorageResponse, cookies || []);
    });
  }
}

// Format and sort
function mergeStorageData(webStorage, cookies) {
  const merged = [];

  // Local
  for (const [key, val] of Object.entries(webStorage.localStorage || {})) {
    merged.push({
      type: 'localStorage',
      key,
      value: val,
      size: StorageUtils.getByteSize(val)
    });
  }

  // Session
  for (const [key, val] of Object.entries(webStorage.sessionStorage || {})) {
    merged.push({
      type: 'sessionStorage',
      key,
      value: val,
      size: StorageUtils.getByteSize(val)
    });
  }

  // Cookies
  cookies.forEach(c => {
    merged.push({
      type: 'cookie',
      key: c.name,
      value: c.value,
      size: StorageUtils.getByteSize(c.value)
    });
  });

  popupStorageData = merged;
  renderStats();
  renderItemsList();
}

// Render counters and gauge
function renderStats() {
  const totalCount = popupStorageData.length;
  const totalSize = popupStorageData.reduce((acc, curr) => acc + curr.size, 0);

  els.statTotalCount.textContent = totalCount;
  els.statTotalSize.textContent = StorageUtils.formatBytes(totalSize);

  // Segment allocations
  const localSize = popupStorageData.filter(i => i.type === 'localStorage').reduce((a,c) => a + c.size, 0);
  const sessionSize = popupStorageData.filter(i => i.type === 'sessionStorage').reduce((a,c) => a + c.size, 0);
  const cookieSize = popupStorageData.filter(i => i.type === 'cookie').reduce((a,c) => a + c.size, 0);

  const totalBytes = localSize + sessionSize + cookieSize || 1; // avoid divide by zero

  const lp = (localSize / totalBytes) * 100;
  const sp = (sessionSize / totalBytes) * 100;
  const cp = (cookieSize / totalBytes) * 100;

  els.segLocal.style.width = `${lp}%`;
  els.segSession.style.width = `${sp}%`;
  els.segCookie.style.width = `${cp}%`;
}

// Render search-filtered items in quick list
function renderItemsList() {
  const query = els.popupSearch.value.trim().toLowerCase();
  
  let filtered = [...popupStorageData];
  if (query) {
    filtered = filtered.filter(item => {
      return item.key.toLowerCase().includes(query) || item.value.toLowerCase().includes(query);
    });
  }

  els.itemsList.innerHTML = '';

  if (filtered.length === 0) {
    els.itemsList.innerHTML = '<li class="empty-state-small">No matching keys.</li>';
    return;
  }

  // Render top 12 items in popup (to prevent overflow)
  filtered.slice(0, 12).forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-item';

    // Type indicators
    let label = 'LS';
    let badgeClass = 'badge-local';
    if (item.type === 'sessionStorage') { label = 'SS'; badgeClass = 'badge-session'; }
    if (item.type === 'cookie') { label = 'CK'; badgeClass = 'badge-cookie'; }

    const previewVal = item.value.length > 40 ? item.value.substring(0, 40) + '...' : item.value;

    li.innerHTML = `
      <div class="item-left">
        <span class="item-key truncate"><span class="badge ${badgeClass}" style="padding: 1px 3px; font-size: 9px; margin-right: 4px;">${label}</span> ${StorageUtils.escapeHtml(item.key)}</span>
        <span class="item-val-preview truncate">${StorageUtils.escapeHtml(previewVal)}</span>
      </div>
      <div class="item-right">
        <button class="btn-item-action copy-action" title="Copy value">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0-2-.9-2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
        <button class="btn-item-action delete-action" title="Delete key">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;

    // Bind item buttons
    li.querySelector('.copy-action').onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(item.value);
      
      const copyBtn = li.querySelector('.copy-action');
      const orig = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span style="font-size: 8px; color: var(--color-success)">✓</span>';
      setTimeout(() => { copyBtn.innerHTML = orig; }, 1500);
    };

    li.querySelector('.delete-action').onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Remove key "${item.key}"?`)) {
        deleteItem(item.type, item.key);
      }
    };

    // Clicking row copies key (developer friendly)
    li.onclick = () => {
      navigator.clipboard.writeText(item.key);
      const keySpan = li.querySelector('.item-key');
      const orig = keySpan.innerHTML;
      keySpan.innerHTML = '<span style="color: var(--color-brand)">Key Copied!</span>';
      setTimeout(() => { keySpan.innerHTML = orig; }, 1200);
    };

    els.itemsList.appendChild(li);
  });

  if (filtered.length > 12) {
    const moreLi = document.createElement('li');
    moreLi.className = 'empty-state-small';
    moreLi.style.cursor = 'pointer';
    moreLi.style.textDecoration = 'underline';
    moreLi.textContent = `And ${filtered.length - 12} more items... Open Dashboard`;
    moreLi.onclick = () => {
      chrome.runtime.openOptionsPage();
    };
    els.itemsList.appendChild(moreLi);
  }
}

// Delete from webpage
function deleteItem(type, key) {
  if (!activeTabId) return;

  if (type === 'cookie') {
    chrome.runtime.sendMessage({
      type: 'REMOVE_COOKIE',
      url: activeTabUrl,
      cookieDetails: { name: key }
    }, (res) => {
      if (res && res.success) {
        fetchData();
      }
    });
  } else {
    chrome.tabs.sendMessage(activeTabId, {
      type: 'REMOVE_STORAGE_ITEM',
      storageType: type,
      key
    }, (res) => {
      if (res && res.success) {
        fetchData();
      }
    });
  }
}
