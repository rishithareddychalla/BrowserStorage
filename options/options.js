// Options Panel Controller - StorageVault

// Safe mock for non-extension environments (e.g. direct HTML view)
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs || !chrome.storage) {
  window.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: (msg, cb) => {
        if (msg.type === 'GET_COOKIES') cb([]);
        else if (cb) cb({ success: true });
      },
      openOptionsPage: () => console.log('Mock: Open Options Page')
    },
    tabs: {
      query: (query, cb) => {
        cb([
          { id: 1, url: 'https://example.com', title: 'Interactive Mock Workspace', active: true, favIconUrl: 'https://www.google.com/s2/favicons?domain=example.com' }
        ]);
      },
      onUpdated: { addListener: () => {} },
      sendMessage: (id, msg, cb) => {
        if (msg.type === 'GET_PAGE_STORAGE') {
          cb({
            success: true,
            localStorage: {
              'user_session_token': 'sk-proj-48charsofdummyopenaiapikeykeyvaluethatislong',
              'theme_mode': 'dark',
              'cart_items': '{"items":[{"id":102,"qty":2},{"id":405,"qty":1}]}',
              'temp_state': 'debugging_logs',
              'jwt_auth_debug': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
            },
            sessionStorage: {
              'tab_session_id': 'sess_993847291a',
              'temp_state': 'debugging_logs' // Duplicate key for cleanup test
            },
            indexedDB: {
              'AppDatabase :: users_store': '[\n  {\n    "id": 1,\n    "name": "Jane Developer",\n    "role": "Lead Architect"\n  },\n  {\n    "id": 2,\n    "name": "Alex Admin",\n    "role": "Systems Operator"\n  }\n]',
              'AnalyticsCache :: events_v2': '[\n  {\n    "event": "page_view",\n    "timestamp": 1720541100000\n  }\n]'
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
    },
    storage: {
      local: {
        get: (keys, cb) => {
          cb({
            snapshots: [
              {
                id: 'snap-1',
                label: 'Baseline Clean State',
                timestamp: Date.now() - 3600000 * 2,
                items: [
                  { type: 'localStorage', key: 'theme_mode', value: 'dark', size: 4 },
                  { type: 'cookie', key: '_ga', value: 'GA1.2.192847192.12847291', size: 24 }
                ]
              },
              {
                id: 'snap-2',
                label: 'Post-Auth State',
                timestamp: Date.now() - 3600000,
                items: [
                  { type: 'localStorage', key: 'theme_mode', value: 'dark', size: 4 },
                  { type: 'cookie', key: '_ga', value: 'GA1.2.192847192.12847291', size: 24 },
                  { type: 'localStorage', key: 'user_session_token', value: 'sk-proj-48charsofdummyopenaiapikeykeyvaluethatislong', size: 52 }
                ]
              }
            ],
            metadataStore: {},
            exclusions: '',
            liveSync: true,
            pollInterval: 2000
          });
        },
        set: (obj, cb) => { if (cb) cb(); }
      }
    }
  };
}

// App state
let activeTabId = null;
let activeTabUrl = '';
let activeTabTitle = '';
let storageData = []; // Combined storage items: { id, type, key, value, size, created, modified }
let snapshotsList = [];
let metadataStore = {}; // Metadata tracking firstSeen and lastModified: { "domain::type::key": { firstSeen, lastModified } }
let selectedItem = null;
let currentPanel = 'panel-dashboard';
let pollIntervalTimer = null;

// Session-level change log for the timeline chart
let sessionChangeLog = {
  added: 0,
  modified: 0,
  deleted: 0,
  history: [] // { timestamp, added, modified, deleted }
};

// UI Elements
const els = {
  tabSelect: null, // Dynamically created in header/sidebar
  statusFavicon: document.getElementById('status-favicon'),
  statusTabTitle: document.getElementById('status-tab-title'),
  statusTabUrl: document.getElementById('status-tab-url'),
  statusQuotaFill: document.getElementById('status-quota-fill'),
  quotaValue: document.getElementById('quota-value'),
  connectionStatusBadge: document.getElementById('connection-status-badge'),
  connectionStatusText: document.getElementById('connection-status-text'),
  panelTitle: document.getElementById('panel-title'),
  
  // Dashboard
  dashLocalCount: document.getElementById('dash-local-count'),
  dashLocalSize: document.getElementById('dash-local-size'),
  dashSessionCount: document.getElementById('dash-session-count'),
  dashSessionSize: document.getElementById('dash-session-size'),
  dashCookieCount: document.getElementById('dash-cookie-count'),
  dashCookieSize: document.getElementById('dash-cookie-size'),
  dashTotalSize: document.getElementById('dash-total-size'),
  dashLargestItemLbl: document.getElementById('dash-largest-item-lbl'),
  dashHeatmap: document.getElementById('dash-heatmap'),
  dashQuotaGauge: document.getElementById('dash-quota-gauge'),
  dashHealthGrade: document.getElementById('dash-health-grade'),
  dashHealthScore: document.getElementById('dash-health-score'),
  dashHealthFill: document.getElementById('dash-health-fill'),
  dashHealthSuggestions: document.getElementById('dash-health-suggestions'),
  dashCleanupList: document.getElementById('dash-cleanup-list'),
  btnQuickCleanup: document.getElementById('btn-quick-cleanup'),
  
  // Explorer
  explorerSearch: document.getElementById('explorer-search'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  explorerFilterType: document.getElementById('explorer-filter-type'),
  explorerSortBy: document.getElementById('explorer-sort-by'),
  explorerItemsCount: document.getElementById('explorer-items-count'),
  explorerTableBody: document.getElementById('explorer-table-body'),
  btnExportAll: document.getElementById('btn-export-all'),
  btnClearAllStorage: document.getElementById('btn-clear-all-storage'),
  btnAddItem: document.getElementById('btn-add-item'),
  btnRefresh: document.getElementById('btn-refresh'),

  // Analytics
  analyticsDonut: document.getElementById('analytics-donut'),
  analyticsHealthScore: document.getElementById('analytics-health-score'),
  analyticsRiskBadge: document.getElementById('analytics-risk-badge'),
  analyticsBars: document.getElementById('analytics-bars'),
  analyticsTimeline: document.getElementById('analytics-timeline'),
  diagDupsCount: document.getElementById('diag-dups-count'),
  diagUnusedCount: document.getElementById('diag-unused-count'),
  diagSecurityCount: document.getElementById('diag-security-count'),
  diagCookieCount: document.getElementById('diag-cookie-count'),

  // Security Scanner
  secCountCritical: document.getElementById('sec-count-critical'),
  secCountHigh: document.getElementById('sec-count-high'),
  secCountMedium: document.getElementById('sec-count-medium'),
  secCountInfo: document.getElementById('sec-count-info'),
  securityResultsList: document.getElementById('security-results-list'),
  securityAlertDot: document.querySelector('.security-alert-dot'),

  // Snapshots
  snapshotLabelInput: document.getElementById('snapshot-label-input'),
  btnTakeSnapshot: document.getElementById('btn-take-snapshot'),
  snapshotsList: document.getElementById('snapshots-list'),
  selectSnapBase: document.getElementById('select-snap-base'),
  selectSnapCompare: document.getElementById('select-snap-compare'),
  btnCompareSnaps: document.getElementById('btn-compare-snaps'),
  snapshotComparisonResults: document.getElementById('snapshot-comparison-results'),

  // Settings
  themeSelect: document.getElementById('theme-select'),
  settingLiveSync: document.getElementById('setting-live-sync'),
  settingPollInterval: document.getElementById('setting-poll-interval'),
  settingExclusions: document.getElementById('setting-exclusions'),
  btnPurgeSnapshots: document.getElementById('btn-purge-local-snapshots'),
  btnWipeActiveStorage: document.getElementById('btn-wipe-all-tab-storage'),

  // Details panel
  detailDrawer: document.getElementById('detail-drawer'),
  detailTypeBadge: document.getElementById('detail-type-badge'),
  detailKeyDisplay: document.getElementById('detail-key-display'),
  detailCloseBtn: document.getElementById('btn-close-detail'),
  btnDetailCopyVal: document.getElementById('btn-detail-copy-val'),
  btnDetailExport: document.getElementById('btn-detail-export'),
  btnDetailDelete: document.getElementById('btn-detail-delete'),
  detailStatChars: document.getElementById('detail-stat-chars'),
  detailStatSize: document.getElementById('detail-stat-size'),
  detailAlerts: document.getElementById('detail-alerts'),
  detailRawTextarea: document.getElementById('detail-raw-textarea'),
  btnSaveRaw: document.getElementById('btn-save-raw'),
  detailJsonTreeContainer: document.getElementById('detail-json-tree-container'),
  detailJwtHeaderTree: document.getElementById('detail-jwt-header-tree'),
  detailJwtPayloadTree: document.getElementById('detail-jwt-payload-tree'),
  detailBase64Textarea: document.getElementById('detail-base64-textarea'),
  btnCopyBase64Decoded: document.getElementById('btn-copy-base64-decoded'),
  btnJsonExpand: document.getElementById('btn-json-expand'),
  btnJsonCollapse: document.getElementById('btn-json-collapse'),

  // Modal
  modalAddEntry: document.getElementById('modal-add-entry'),
  modalTitle: document.getElementById('modal-title'),
  btnModalClose: document.getElementById('btn-modal-close'),
  modalInputType: document.getElementById('modal-input-type'),
  modalInputKey: document.getElementById('modal-input-key'),
  modalInputValue: document.getElementById('modal-input-value'),
  modalCookieParams: document.getElementById('modal-cookie-params-section'),
  cookieInputPath: document.getElementById('cookie-input-path'),
  cookieInputExp: document.getElementById('cookie-input-exp'),
  cookieInputSecure: document.getElementById('cookie-input-secure'),
  cookieInputHttp: document.getElementById('cookie-input-http'),
  btnModalCancel: document.getElementById('btn-modal-cancel'),
  btnModalSave: document.getElementById('btn-modal-save')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initSidebar();
  initDetailsPanel();
  initModals();
  initSettings();
  initTimeline();
  
  // Discover pages to inspect
  await refreshTabsList();
  
  // Listen for active tab completion (reloads)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === activeTabId && changeInfo.status === 'complete') {
      console.log('[StorageVault] Connected tab refreshed. Updating storage data.');
      refreshData();
    }
  });

  // Listen for storage changes from content scripts
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!els.settingLiveSync.checked) return;

    if (message.type === 'STORAGE_CHANGE') {
      if (sender.tab && sender.tab.id === activeTabId) {
        handleIncomingStorageChange(message.data);
      }
    } else if (message.type === 'COOKIE_CHANGE') {
      if (activeTabUrl && !activeTabUrl.startsWith('file://')) {
        const urlObj = new URL(activeTabUrl);
        const cookieDomain = message.data.cookie.domain;
        // Check if cookie matches active tab host
        if (urlObj.hostname && urlObj.hostname.includes(cookieDomain.replace(/^\./, ''))) {
          handleIncomingCookieChange(message.data);
        }
      }
    }
  });
});

// Load state from local storage
async function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['snapshots', 'metadataStore', 'exclusions', 'liveSync', 'pollInterval'], (res) => {
      snapshotsList = res.snapshots || [];
      metadataStore = res.metadataStore || {};
      
      if (res.exclusions !== undefined) els.settingExclusions.value = res.exclusions;
      if (res.liveSync !== undefined) els.settingLiveSync.checked = res.liveSync;
      if (res.pollInterval !== undefined) els.settingPollInterval.value = res.pollInterval;
      
      resolve();
    });
  });
}

// Save metadata store
async function saveMetadataStore() {
  chrome.storage.local.set({ metadataStore });
}

// Render dynamic tabs selector in the Connected Tab box
async function refreshTabsList() {
  chrome.tabs.query({}, (tabs) => {
    const inspectable = tabs.filter(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://') || t.url.startsWith('file://')));
    
    // Create tab selector
    const container = document.querySelector('.connected-tab-info');
    container.innerHTML = '';

    if (inspectable.length === 0) {
      container.innerHTML = `
        <div class="tab-details">
          <span class="tab-title">No Inspectable Tabs</span>
          <span class="tab-url">Open a webpage in browser</span>
        </div>
      `;
      activeTabId = null;
      activeTabUrl = '';
      activeTabTitle = '';
      updateConnectionStatus(false);
      clearUIData();
      return;
    }

    const select = document.createElement('select');
    select.className = 'input select-tab-conn';
    select.style.width = '100%';
    select.style.fontSize = '12px';
    select.style.padding = '4px 8px';
    select.style.backgroundColor = 'transparent';
    select.style.border = 'none';
    select.style.color = 'var(--text-primary)';
    select.style.cursor = 'pointer';
    
    inspectable.forEach(tab => {
      const opt = document.createElement('option');
      opt.value = tab.id;
      opt.textContent = `${tab.title.substring(0, 25)}... (${new URL(tab.url).hostname || 'local-file'})`;
      opt.style.backgroundColor = 'var(--bg-sidebar)';
      select.appendChild(opt);
    });

    container.appendChild(select);
    
    // Choose active tab (either the last one or the first inspectable)
    let initialTab = inspectable[0];
    // Try to find if currently active tab in some window is inspectable
    const currentlyActive = inspectable.find(t => t.active);
    if (currentlyActive) {
      initialTab = currentlyActive;
    }

    select.value = initialTab.id;
    connectToTab(initialTab.id, initialTab.url, initialTab.title, initialTab.favIconUrl);

    select.addEventListener('change', (e) => {
      const selectedId = parseInt(e.target.value);
      const tab = inspectable.find(t => t.id === selectedId);
      if (tab) {
        connectToTab(tab.id, tab.url, tab.title, tab.favIconUrl);
      }
    });
  });
}

function updateConnectionStatus(connected) {
  if (connected) {
    els.connectionStatusBadge.classList.add('connected');
    els.connectionStatusText.textContent = 'Connected';
  } else {
    els.connectionStatusBadge.classList.remove('connected');
    els.connectionStatusText.textContent = 'Disconnected';
  }
}

// Connect to selected tab
function connectToTab(tabId, url, title, favIcon) {
  activeTabId = tabId;
  activeTabUrl = url;
  activeTabTitle = title;
  
  if (favIcon) {
    els.statusFavicon.src = favIcon;
    els.statusFavicon.classList.remove('hidden');
  } else {
    els.statusFavicon.classList.add('hidden');
  }

  els.statusTabTitle.textContent = title;
  els.statusTabUrl.textContent = url;
  
  updateConnectionStatus(true);
  refreshData();
  setupPolling();
}

// Configure Polling fallback if active sync fails or disabled
function setupPolling() {
  if (pollIntervalTimer) clearInterval(pollIntervalTimer);
  
  const isSync = els.settingLiveSync.checked;
  if (!isSync) return;

  const interval = parseInt(els.settingPollInterval.value) || 2000;
  pollIntervalTimer = setInterval(() => {
    // Only poll silently (merge updates, don't trigger heavy loader UI)
    fetchStorageSilently();
  }, interval);
}

// Clear UI elements when disconnected
function clearUIData() {
  storageData = [];
  renderDashboard();
  renderExplorerTable();
  renderAnalytics();
  renderSecurityScan();
}

// Fetch all storage areas for active tab
async function refreshData() {
  if (!activeTabId) return;

  // Show loading skeleton / indicator
  els.explorerTableBody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div class="skeleton-row" style="margin-bottom: 12px; height: 16px; width: 60%; background: var(--bg-hover); border-radius: 4px;"></div>
        <div class="skeleton-row" style="margin-bottom: 12px; height: 16px; width: 80%; background: var(--bg-hover); border-radius: 4px;"></div>
        <span>Retrieving storage tables...</span>
      </td>
    </tr>
  `;

  try {
    const rawData = await fetchAllStorageAreas();
    processAndMergeStorage(rawData);
    
    // Render panels
    renderDashboard();
    renderExplorerTable();
    renderAnalytics();
    renderSecurityScan();
    renderSnapshotsList();
  } catch (e) {
    els.explorerTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--color-danger);">
          Failed to communicate with tab context. Ensure the page is not sandboxed or an extension dashboard.
        </td>
      </tr>
    `;
    updateConnectionStatus(false);
  }
}

// Polling storage update (silently merges)
async function fetchStorageSilently() {
  if (!activeTabId) return;
  try {
    const rawData = await fetchAllStorageAreas();
    processAndMergeStorage(rawData, true); // true = silent (highlights differences)
  } catch (e) {}
}

// Low-level fetch storage from active tab
function fetchAllStorageAreas() {
  return new Promise((resolve, reject) => {
    // 1. Get localStorage & sessionStorage via content script
    chrome.tabs.sendMessage(activeTabId, { type: 'GET_PAGE_STORAGE' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        // Fallback: try injecting content script dynamically if it was unloaded
        chrome.scripting.executeScript({
          target: { tabId: activeTabId },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            // Also inject inject.js into the MAIN world
            chrome.scripting.executeScript({
              target: { tabId: activeTabId },
              files: ['inject.js'],
              world: 'MAIN'
            }, () => {
              // Try again
              chrome.tabs.sendMessage(activeTabId, { type: 'GET_PAGE_STORAGE' }, (res) => {
                if (chrome.runtime.lastError || !res || !res.success) {
                  reject(new Error("Content script unreachable"));
                } else {
                  fetchCookies(res);
                }
              });
            });
          }
        });
      } else {
        fetchCookies(response);
      }
    });

    // Helper: Fetch cookies once Web Storage is fetched
    function fetchCookies(webStorageResponse) {
      if (activeTabUrl.startsWith('file://')) {
        resolve({
          localStorage: webStorageResponse.localStorage || {},
          sessionStorage: webStorageResponse.sessionStorage || {},
          indexedDB: webStorageResponse.indexedDB || {},
          cookies: []
        });
      } else {
        chrome.cookies.getAll({ url: activeTabUrl }, (cookies) => {
          resolve({
            localStorage: webStorageResponse.localStorage || {},
            sessionStorage: webStorageResponse.sessionStorage || {},
            indexedDB: webStorageResponse.indexedDB || {},
            cookies: cookies || []
          });
        });
      }
    }
  });
}

// Convert raw storage responses to unified structures
function processAndMergeStorage(raw, silentMerge = false) {
  const domain = new URL(activeTabUrl).hostname || 'local-file';
  const newItems = [];
  const exclusions = els.settingExclusions.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  // Helper to push processed items
  function addItem(type, key, value) {
    // Filter exclusions
    const lowerKey = key.toLowerCase();
    if (exclusions.some(exc => lowerKey.includes(exc))) return;

    // Coerce value to string safely to avoid null/undefined crashes
    const valString = value !== undefined && value !== null ? String(value) : '';

    const size = StorageUtils.getByteSize(valString);
    const metaKey = `${domain}::${type}::${key}`;
    
    // Creation Time & Last Updated estimates
    let firstSeen = Date.now();
    let lastModified = Date.now();

    if (metadataStore[metaKey]) {
      firstSeen = metadataStore[metaKey].firstSeen;
      lastModified = metadataStore[metaKey].lastModified;
      
      // If value changed, update lastModified
      const oldItem = storageData.find(i => i.type === type && i.key === key);
      if (oldItem && oldItem.value !== valString) {
        lastModified = Date.now();
        metadataStore[metaKey].lastModified = lastModified;
        
        // Log to session history for timeline
        logSessionChange('modified');
      }
    } else {
      metadataStore[metaKey] = { firstSeen, lastModified };
      if (storageData.length > 0) {
        logSessionChange('added');
      }
    }

    newItems.push({
      id: `${type}::${key}`,
      type,
      key,
      value: valString,
      size,
      created: firstSeen,
      modified: lastModified
    });
  }

  // Parse LocalStorage
  for (const [key, val] of Object.entries(raw.localStorage)) {
    addItem('localStorage', key, val);
  }

  // Parse SessionStorage
  for (const [key, val] of Object.entries(raw.sessionStorage)) {
    addItem('sessionStorage', key, val);
  }

  // Parse Cookies
  raw.cookies.forEach(c => {
    addItem('cookie', c.name, c.value);
  });

  // Parse IndexedDB
  if (raw.indexedDB) {
    for (const [key, val] of Object.entries(raw.indexedDB)) {
      addItem('indexedDB', key, val);
    }
  }

  // Check for deleted items
  if (storageData.length > 0) {
    storageData.forEach(oldItem => {
      const stillExists = newItems.some(i => i.type === oldItem.type && i.key === oldItem.key);
      if (!stillExists) {
        logSessionChange('deleted');
        // Delete metadata entry
        const metaKey = `${domain}::${oldItem.type}::${oldItem.key}`;
        delete metadataStore[metaKey];
      }
    });
  }

  saveMetadataStore();

  // If merging silently, we detect differences and apply animations
  if (silentMerge) {
    detectDiffsAndAnimate(newItems);
  }

  storageData = newItems;
}

// Log changes to session and push to timeline
function logSessionChange(actionType) {
  sessionChangeLog[actionType]++;
  sessionChangeLog.history.push({
    timestamp: Date.now(),
    action: actionType
  });
  
  // Throttle updates to UI components if needed
  updateTimelineUI();
}

// Track diff changes to highlight rows on live-sync
function detectDiffsAndAnimate(newList) {
  const currentMap = new Map(storageData.map(i => [i.id, i.value]));
  const tableRows = els.explorerTableBody.querySelectorAll('tr');
  const rowMap = new Map();
  
  tableRows.forEach(row => {
    const itemId = row.getAttribute('data-id');
    if (itemId) rowMap.set(itemId, row);
  });

  let hasChanges = false;

  newList.forEach(item => {
    if (!currentMap.has(item.id)) {
      // Item added!
      hasChanges = true;
      setTimeout(() => animateRow(item.id, 'row-add'), 100);
    } else if (currentMap.get(item.id) !== item.value) {
      // Item modified!
      hasChanges = true;
      setTimeout(() => animateRow(item.id, 'row-edit'), 100);
    }
  });

  if (newList.length !== storageData.length) {
    hasChanges = true;
  }

  // Helper to add classes
  function animateRow(id, className) {
    const row = rowMap.get(id);
    if (row) {
      row.classList.add(className);
      // Remove class after animation cycles
      setTimeout(() => row.classList.remove(className), 1500);
    }
  }

  // If changes found, redraw analytical metrics silently
  if (hasChanges) {
    renderDashboard();
    renderAnalytics();
    renderSecurityScan();
  }
}

// Handle live synchronization events from inject.js
function handleIncomingStorageChange(detail) {
  const { storageType, action, key, newValue } = detail;
  
  // Reread and merge data
  fetchStorageSilently();
}

// Handle live cookie sync
function handleIncomingCookieChange(detail) {
  fetchStorageSilently();
}

// ==========================================
// RENDER MODULES
// ==========================================

// RENDER: DASHBOARD VIEW
function renderDashboard() {
  const locals = storageData.filter(i => i.type === 'localStorage');
  const sessions = storageData.filter(i => i.type === 'sessionStorage');
  const cookies = storageData.filter(i => i.type === 'cookie');
  const indexeds = storageData.filter(i => i.type === 'indexedDB');

  const localSize = locals.reduce((acc, curr) => acc + curr.size, 0);
  const sessionSize = sessions.reduce((acc, curr) => acc + curr.size, 0);
  const cookieSize = cookies.reduce((acc, curr) => acc + curr.size, 0);
  const indexedSize = indexeds.reduce((acc, curr) => acc + curr.size, 0);
  const totalSize = localSize + sessionSize + cookieSize + indexedSize;

  // Counter animations or text insertion
  els.dashLocalCount.textContent = locals.length;
  els.dashLocalSize.textContent = StorageUtils.formatBytes(localSize);
  els.dashSessionCount.textContent = sessions.length;
  els.dashSessionSize.textContent = StorageUtils.formatBytes(sessionSize);
  els.dashCookieCount.textContent = cookies.length;
  els.dashCookieSize.textContent = StorageUtils.formatBytes(cookieSize);
  
  els.dashTotalSize.textContent = StorageUtils.formatBytes(totalSize);

  // Set largest item
  if (storageData.length > 0) {
    const sorted = [...storageData].sort((a,b) => b.size - a.size);
    els.dashLargestItemLbl.textContent = `Largest: ${sorted[0].key} (${StorageUtils.formatBytes(sorted[0].size)})`;
  } else {
    els.dashLargestItemLbl.textContent = 'Largest: None';
  }

  // Update Status Quota Meter in sidebar (combined LS and SS sizes, max 5MB quota)
  const quotaBytes = localSize + sessionSize;
  const quotaMax = 5 * 1024 * 1024;
  const quotaPercent = Math.min(100, (quotaBytes / quotaMax) * 100);
  
  els.statusQuotaFill.style.width = `${quotaPercent}%`;
  els.quotaValue.textContent = `${StorageUtils.formatBytes(quotaBytes)} / 5 MB`;

  // Colors check
  if (quotaPercent > 85) els.statusQuotaFill.style.backgroundColor = 'var(--color-danger)';
  else if (quotaPercent > 50) els.statusQuotaFill.style.backgroundColor = 'var(--color-warning)';
  else els.statusQuotaFill.style.backgroundColor = 'var(--color-brand)';

  // Render Storage Gauge in dashboard
  UIComponents.renderStorageGauge(els.dashQuotaGauge, quotaBytes, quotaMax);

  // Render Heatmap Grid in dashboard
  UIComponents.renderHeatmap(els.dashHeatmap, storageData, (item) => {
    openInspectorPanel(item);
  });

  // Calculate Health & Suggestions
  const duplicates = StorageUtils.findDuplicates(storageData);
  const unused = StorageUtils.findUnusedKeys(storageData);
  
  // Total security issues
  let securityIssuesCount = 0;
  storageData.forEach(item => {
    securityIssuesCount += StorageUtils.scanSecurity(item.key, item.value).length;
  });

  const health = StorageUtils.calculateHealthScore(storageData, duplicates, unused, securityIssuesCount);
  
  // Render health
  els.dashHealthScore.textContent = `${health.score} / 100`;
  els.dashHealthGrade.textContent = health.grade;
  els.dashHealthFill.style.width = `${health.score}%`;

  // Grade color
  if (health.score >= 90) els.dashHealthGrade.style.color = 'var(--color-success)';
  else if (health.score >= 70) els.dashHealthGrade.style.color = 'var(--color-warning)';
  else els.dashHealthGrade.style.color = 'var(--color-danger)';

  // Suggestion list
  els.dashHealthSuggestions.innerHTML = '';
  if (health.recommendations.length === 0) {
    els.dashHealthSuggestions.innerHTML = `<div class="empty-state-small">All checks passed! Great job.</div>`;
  } else {
    health.recommendations.forEach(rec => {
      const div = document.createElement('div');
      div.className = `suggestion-item priority-${rec.priority}`;
      div.innerHTML = `<span>${rec.text}</span>`;
      els.dashHealthSuggestions.appendChild(div);
    });
  }

  // Cleanup recommendations list
  els.dashCleanupList.innerHTML = '';
  const cleanupCandidates = [];
  
  duplicates.forEach(dup => {
    dup.items.slice(1).forEach(item => {
      cleanupCandidates.push({
        id: item.id,
        key: item.key,
        type: item.type,
        reason: 'Duplicate value entry'
      });
    });
  });

  unused.forEach(un => {
    cleanupCandidates.push({
      id: un.item.id,
      key: un.item.key,
      type: un.item.type,
      reason: un.reason
    });
  });

  if (cleanupCandidates.length === 0) {
    els.dashCleanupList.innerHTML = `<div class="empty-state-small">No immediate cleanup recommended.</div>`;
    els.btnQuickCleanup.classList.add('hidden');
  } else {
    els.btnQuickCleanup.classList.remove('hidden');
    // Limit to 4 elements in list
    cleanupCandidates.slice(0, 4).forEach(cand => {
      const div = document.createElement('div');
      div.className = 'cleanup-item';
      div.innerHTML = `
        <div class="cleanup-item-details">
          <span class="cleanup-item-key truncate">${cand.key}</span>
          <span class="cleanup-item-reason">[${cand.type.toUpperCase()}] - ${cand.reason}</span>
        </div>
        <button class="btn btn-xs" data-cleanup-id="${cand.id}">Clean</button>
      `;

      div.querySelector('button').addEventListener('click', () => {
        deleteStorageItem(cand.type, cand.key);
      });

      els.dashCleanupList.appendChild(div);
    });
  }

  // Bind one-click cleanup
  els.btnQuickCleanup.onclick = () => {
    if (confirm(`Wipe all ${cleanupCandidates.length} recommended temporary/duplicate keys?`)) {
      cleanupCandidates.forEach(cand => {
        deleteStorageItem(cand.type, cand.key);
      });
    }
  };
}

// RENDER: STORAGE EXPLORER TABLE
function renderExplorerTable() {
  const query = els.explorerSearch.value.trim().toLowerCase();
  const filterType = els.explorerFilterType.value;
  const sortBy = els.explorerSortBy.value;

  // Filter items
  let filtered = [...storageData];

  if (filterType === 'localStorage') {
    filtered = filtered.filter(i => i.type === 'localStorage');
  } else if (filterType === 'sessionStorage') {
    filtered = filtered.filter(i => i.type === 'sessionStorage');
  } else if (filterType === 'cookie') {
    filtered = filtered.filter(i => i.type === 'cookie');
  } else if (filterType === 'indexedDB') {
    filtered = filtered.filter(i => i.type === 'indexedDB');
  } else if (filterType === 'large') {
    filtered = filtered.filter(i => i.size > 10 * 1024); // > 10KB
  } else if (filterType === 'recent') {
    // Modified in the last 5 minutes
    filtered = filtered.filter(i => (Date.now() - i.modified) < 5 * 60 * 1000);
  }

  // Search filter
  if (query) {
    filtered = filtered.filter(item => {
      return item.key.toLowerCase().includes(query) || 
             item.value.toLowerCase().includes(query) ||
             item.type.toLowerCase().includes(query) ||
             StorageUtils.formatBytes(item.size).toLowerCase().includes(query);
    });
    els.btnClearSearch.classList.remove('hidden');
  } else {
    els.btnClearSearch.classList.add('hidden');
  }

  // Sort items
  filtered.sort((a, b) => {
    if (sortBy === 'name-asc') return a.key.localeCompare(b.key);
    if (sortBy === 'name-desc') return b.key.localeCompare(a.key);
    if (sortBy === 'type-asc') return a.type.localeCompare(b.type);
    if (sortBy === 'size-desc') return b.size - a.size;
    if (sortBy === 'size-asc') return a.size - b.size;
    return 0;
  });

  els.explorerItemsCount.textContent = `Showing ${filtered.length} of ${storageData.length} items`;
  
  els.explorerTableBody.innerHTML = '';
  
  if (filtered.length === 0) {
    els.explorerTableBody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" width="40" height="40"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            <h3>No entries found</h3>
            <p>Adjust your search criteria, filter options, or add a new record to inspect.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', item.id);
    if (selectedItem && selectedItem.id === item.id) {
      tr.className = 'selected';
    }

    // Badge styling
    let badgeClass = 'badge-local';
    let badgeLabel = 'Local';
    if (item.type === 'sessionStorage') { badgeClass = 'badge-session'; badgeLabel = 'Session'; }
    if (item.type === 'cookie') { badgeClass = 'badge-cookie'; badgeLabel = 'Cookie'; }
    if (item.type === 'indexedDB') { badgeClass = 'badge-indexed'; badgeLabel = 'IndexedDB'; }

    // Estimate relative dates
    const dateFormatted = new Date(item.modified).toLocaleTimeString();

    // Key highlight
    const rawKey = item.key;
    const highlightedKey = query ? highlightText(rawKey, query) : StorageUtils.escapeHtml(rawKey);
    
    // Value preview truncated
    const rawVal = item.value;
    const valTrunc = rawVal.length > 80 ? rawVal.substring(0, 80) + '...' : rawVal;
    const highlightedVal = query ? highlightText(valTrunc, query) : StorageUtils.escapeHtml(valTrunc);

    tr.innerHTML = `
      <td class="type-cell-badge">
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </td>
      <td class="row-key-cell truncate">${highlightedKey}</td>
      <td class="row-val-cell truncate">${highlightedVal}</td>
      <td class="size-align-right">${StorageUtils.formatBytes(item.size)}</td>
      <td style="color: var(--text-muted); font-size: 12px;">${dateFormatted}</td>
    `;

    tr.addEventListener('click', () => {
      // Toggle highlight selection
      els.explorerTableBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      openInspectorPanel(item);
    });

    els.explorerTableBody.appendChild(tr);
  });

  // Bind exporter
  els.btnExportAll.onclick = () => {
    StorageUtils.exportData(filtered, 'json', `storage_vault_filtered_${Date.now()}`);
  };

  // Bind clear visible
  els.btnClearAllStorage.onclick = () => {
    if (confirm(`Wipe all ${filtered.length} visible storage keys from this webpage? This cannot be undone.`)) {
      filtered.forEach(item => {
        deleteStorageItem(item.type, item.key);
      });
    }
  };
}

function highlightText(text, searchStr) {
  const escaped = StorageUtils.escapeHtml(text);
  const regex = new RegExp(`(${searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<span class="highlight-search">$1</span>');
}

// RENDER: ANALYTICS
function renderAnalytics() {
  const locals = storageData.filter(i => i.type === 'localStorage');
  const sessions = storageData.filter(i => i.type === 'sessionStorage');
  const cookies = storageData.filter(i => i.type === 'cookie');
  const indexeds = storageData.filter(i => i.type === 'indexedDB');

  // Type donut data
  const data = [
    { label: 'localStorage', value: locals.length, count: locals.length, color: 'var(--color-local)' },
    { label: 'sessionStorage', value: sessions.length, count: sessions.length, color: 'var(--color-session)' },
    { label: 'cookie', value: cookies.length, count: cookies.length, color: 'var(--color-cookie)' },
    { label: 'indexedDB', value: indexeds.length, count: indexeds.length, color: 'var(--color-indexed)' }
  ];

  UIComponents.renderPieChart(els.analyticsDonut, data);

  // Health Stats Calculations
  const duplicates = StorageUtils.findDuplicates(storageData);
  const unused = StorageUtils.findUnusedKeys(storageData);
  let secIssues = 0;
  storageData.forEach(item => {
    secIssues += StorageUtils.scanSecurity(item.key, item.value).length;
  });

  const health = StorageUtils.calculateHealthScore(storageData, duplicates, unused, secIssues);
  els.analyticsHealthScore.textContent = health.score;
  els.analyticsRiskBadge.textContent = health.grade === 'A' ? 'Minimal Risk' : (health.grade === 'B' ? 'Low Risk' : (health.grade === 'C' ? 'Moderate Risk' : 'High Security Risk'));
  
  els.analyticsRiskBadge.className = 'risk-value badge';
  if (health.grade === 'A') els.analyticsRiskBadge.classList.add('badge-session'); // green
  else if (health.grade === 'B') els.analyticsRiskBadge.classList.add('badge-local'); // blue
  else if (health.grade === 'C') els.analyticsRiskBadge.classList.add('badge-cookie'); // orange
  else els.analyticsRiskBadge.classList.add('txt-danger'); // custom red border

  els.diagDupsCount.textContent = duplicates.length;
  els.diagUnusedCount.textContent = unused.length;
  els.diagSecurityCount.textContent = secIssues;
  
  // Security warning indicator for the menu item
  if (secIssues > 0) {
    els.securityAlertDot.classList.remove('hidden');
  } else {
    els.securityAlertDot.classList.add('hidden');
  }

  els.diagCookieCount.textContent = `${cookies.length} / 180`; // estimate max cookies limits

  // Render Top 10 Horizontal size bars
  const largestList = [...storageData].sort((a,b) => b.size - a.size).slice(0, 10);
  UIComponents.renderBarChart(els.analyticsBars, largestList, (item) => {
    openInspectorPanel(item);
  });

  // Re-draw Timeline
  updateTimelineUI();
}

// RENDER: SECURITY SCANNER
function renderSecurityScan() {
  let critical = 0, high = 0, medium = 0, info = 0;
  const findings = [];

  storageData.forEach(item => {
    const risks = StorageUtils.scanSecurity(item.key, item.value);
    risks.forEach(r => {
      if (r.severity === 'critical') critical++;
      if (r.severity === 'high') high++;
      if (r.severity === 'medium') medium++;
      if (r.severity === 'info') info++;

      findings.push({
        item,
        risk: r
      });
    });
  });

  els.secCountCritical.textContent = critical;
  els.secCountHigh.textContent = high;
  els.secCountMedium.textContent = medium;
  els.secCountInfo.textContent = info;

  els.securityResultsList.innerHTML = '';

  if (findings.length === 0) {
    els.securityResultsList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" style="color: var(--color-success); opacity: 1;"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
        <h3 style="color: var(--color-success)">Vulnerability Clean</h3>
        <p>No storage secrets, passwords, or critical service tokens found. Excellent security profile!</p>
      </div>
    `;
    return;
  }

  findings.forEach(find => {
    const card = document.createElement('div');
    card.className = 'security-vulnerability-card';
    
    let sevClass = 'sev-info';
    if (find.risk.severity === 'critical') sevClass = 'sev-critical';
    if (find.risk.severity === 'high') sevClass = 'sev-high';
    if (find.risk.severity === 'medium') sevClass = 'sev-medium';

    card.innerHTML = `
      <div class="security-vuln-left">
        <div class="vuln-badge-row">
          <span class="severity-badge ${sevClass}">${find.risk.severity}</span>
          <span class="badge badge-local" style="text-transform: uppercase;">${find.item.type}</span>
          <span class="vuln-key-name truncate">${StorageUtils.escapeHtml(find.item.key)}</span>
        </div>
        <p class="vuln-desc"><strong>⚠ Possible Secret Found:</strong> ${find.risk.info}</p>
      </div>
      <div class="security-vuln-right">
        <button class="btn btn-sm btn-primary btn-danger-action" style="background: var(--color-danger); border-color: var(--color-danger);">Delete Key</button>
      </div>
    `;

    card.querySelector('.btn').onclick = () => {
      if (confirm(`Wipe key "${find.item.key}" from ${find.item.type}? This might log you out or reset active sessions.`)) {
        deleteStorageItem(find.item.type, find.item.key);
      }
    };

    // Open detail panel on row click (excluding button click)
    card.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        openInspectorPanel(find.item);
      }
    });

    els.securityResultsList.appendChild(card);
  });
}

// RENDER: TIMELINE SESSION GRAPH
function initTimeline() {
  // Push an initial empty columns array
  updateTimelineUI();
}

function updateTimelineUI() {
  if (!els.analyticsTimeline) return;
  const grid = document.getElementById('timeline-chart-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  // Create 15-bucket rolling columns
  // We mock a timeline. Each bar is a slice of actions taken
  // Let's generate data points representing time buckets
  const maxActions = Math.max(10, sessionChangeLog.added + sessionChangeLog.modified + sessionChangeLog.deleted);
  
  // Render the columns.
  // In a real scenario, we map the history log into time intervals.
  // To make it look extremely premium, let's create a real time series.
  const intervalCount = 12;
  const now = Date.now();
  const timeWindow = 5 * 60 * 1000; // 5 mins
  const bucketSize = timeWindow / intervalCount;
  
  const buckets = Array.from({ length: intervalCount }, (_, i) => ({
    label: `${Math.round(((intervalCount - i) * bucketSize) / 1000)}s ago`,
    added: 0,
    modified: 0,
    deleted: 0
  }));

  // Populate buckets
  sessionChangeLog.history.forEach(log => {
    const elapsed = now - log.timestamp;
    if (elapsed < timeWindow) {
      const idx = intervalCount - 1 - Math.floor(elapsed / bucketSize);
      if (idx >= 0 && idx < intervalCount) {
        buckets[idx][log.action]++;
      }
    }
  });

  const maxBucketSum = Math.max(1, ...buckets.map(b => b.added + b.modified + b.deleted));

  buckets.forEach((bucket, idx) => {
    const col = document.createElement('div');
    col.className = 'timeline-column';

    const sum = bucket.added + bucket.modified + bucket.deleted;
    
    // Segment heights as percentages
    const addPct = sum > 0 ? (bucket.added / maxBucketSum) * 100 : 0;
    const modPct = sum > 0 ? (bucket.modified / maxBucketSum) * 100 : 0;
    const delPct = sum > 0 ? (bucket.deleted / maxBucketSum) * 100 : 0;

    col.innerHTML = `
      <div class="timeline-bar-segment" style="height: ${delPct}%; background: var(--color-danger);" title="Deleted: ${bucket.deleted}"></div>
      <div class="timeline-bar-segment" style="height: ${modPct}%; background: var(--color-brand);" title="Modified: ${bucket.modified}"></div>
      <div class="timeline-bar-segment" style="height: ${addPct}%; background: var(--color-success);" title="Added: ${bucket.added}"></div>
      <span class="timeline-column-label">${bucket.label}</span>
    `;

    grid.appendChild(col);
  });
}

// ==========================================
// SNAPSHOTS MODULE
// ==========================================

function renderSnapshotsList() {
  els.snapshotsList.innerHTML = '';
  els.selectSnapBase.innerHTML = '<option value="">Select Base Snapshot</option>';
  els.selectSnapCompare.innerHTML = '<option value="">Select Compare Snapshot</option>';

  if (snapshotsList.length === 0) {
    els.snapshotsList.innerHTML = `<div class="empty-state-small">No snapshots taken. Record states to view lists.</div>`;
    return;
  }

  // Populate lists
  snapshotsList.forEach(snap => {
    // List item
    const div = document.createElement('div');
    div.className = 'snapshot-list-item';
    div.innerHTML = `
      <div class="snapshot-item-meta">
        <span class="snapshot-label truncate">${snap.label}</span>
        <span class="snapshot-time">${new Date(snap.timestamp).toLocaleString()} (${snap.items.length} keys)</span>
      </div>
      <button class="delete-snapshot-btn" title="Delete snapshot">&times;</button>
    `;

    div.querySelector('.delete-snapshot-btn').onclick = (e) => {
      e.stopPropagation();
      deleteSnapshot(snap.id);
    };

    div.onclick = () => {
      // Set selects automatically
      if (!els.selectSnapBase.value) {
        els.selectSnapBase.value = snap.id;
      } else {
        els.selectSnapCompare.value = snap.id;
      }
    };

    els.snapshotsList.appendChild(div);

    // Dropdown selectors
    const opt1 = document.createElement('option');
    opt1.value = snap.id;
    opt1.textContent = snap.label;
    els.selectSnapBase.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = snap.id;
    opt2.textContent = snap.label;
    els.selectSnapCompare.appendChild(opt2);
  });
}

// Take snapshot
els.btnTakeSnapshot.onclick = () => {
  const lbl = els.snapshotLabelInput.value.trim() || `Snapshot ${new Date().toLocaleTimeString()}`;
  const snap = StorageUtils.createSnapshot(storageData, lbl);
  
  snapshotsList.push(snap);
  chrome.storage.local.set({ snapshots: snapshotsList }, () => {
    els.snapshotLabelInput.value = '';
    renderSnapshotsList();
  });
};

function deleteSnapshot(id) {
  snapshotsList = snapshotsList.filter(s => s.id !== id);
  chrome.storage.local.set({ snapshots: snapshotsList }, () => {
    renderSnapshotsList();
  });
}

// Compare snapshots
els.btnCompareSnaps.onclick = () => {
  const baseId = els.selectSnapBase.value;
  const compareId = els.selectSnapCompare.value;

  if (!baseId || !compareId) {
    alert('Please select two snapshots to run differential comparison.');
    return;
  }

  const baseSnap = snapshotsList.find(s => s.id === baseId);
  const compareSnap = snapshotsList.find(s => s.id === compareId);

  if (!baseSnap || !compareSnap) return;

  const diffs = StorageUtils.compareSnapshots(baseSnap, compareSnap);
  renderSnapshotDiffResults(diffs);
};

function renderSnapshotDiffResults(diffs) {
  const container = els.snapshotComparisonResults;
  container.innerHTML = '';

  const totalDiffs = diffs.added.length + diffs.deleted.length + diffs.modified.length;

  if (totalDiffs === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" style="color: var(--color-success); opacity: 1;"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        <h3>No changes detected</h3>
        <p>Both storage snapshots have identical keys and values.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom: 16px;">
      <strong>Diff Summary:</strong> 
      <span class="diff-added">${diffs.added.length} Added</span>, 
      <span class="diff-modified">${diffs.modified.length} Modified</span>, 
      <span class="diff-deleted">${diffs.deleted.length} Deleted</span>
    </div>
  `;

  // Render Added Section
  if (diffs.added.length > 0) {
    html += `
      <div class="diff-list-section">
        <div class="diff-section-header diff-added">+ Added Items (${diffs.added.length})</div>
        <table class="diff-table">
          <thead><tr><th>Type</th><th>Key</th><th>Value</th></tr></thead>
          <tbody>
            ${diffs.added.map(item => `
              <tr class="diff-row-added">
                <td><span class="badge ${getBadgeClass(item.type)}">${item.type}</span></td>
                <td class="row-key-cell">${StorageUtils.escapeHtml(item.key)}</td>
                <td class="row-val-cell truncate">${StorageUtils.escapeHtml(item.value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Render Modified Section
  if (diffs.modified.length > 0) {
    html += `
      <div class="diff-list-section">
        <div class="diff-section-header diff-modified">~ Modified Items (${diffs.modified.length})</div>
        <table class="diff-table">
          <thead><tr><th>Type</th><th>Key</th><th>Old Value</th><th>New Value</th></tr></thead>
          <tbody>
            ${diffs.modified.map(item => `
              <tr class="diff-row-modified">
                <td><span class="badge ${getBadgeClass(item.type)}">${item.type}</span></td>
                <td class="row-key-cell">${StorageUtils.escapeHtml(item.key)}</td>
                <td class="row-val-cell truncate" style="text-decoration: line-through; opacity: 0.5;">${StorageUtils.escapeHtml(item.oldValue)}</td>
                <td class="row-val-cell truncate">${StorageUtils.escapeHtml(item.value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Render Deleted Section
  if (diffs.deleted.length > 0) {
    html += `
      <div class="diff-list-section">
        <div class="diff-section-header diff-deleted">- Deleted Items (${diffs.deleted.length})</div>
        <table class="diff-table">
          <thead><tr><th>Type</th><th>Key</th><th>Value</th></tr></thead>
          <tbody>
            ${diffs.deleted.map(item => `
              <tr class="diff-row-deleted">
                <td><span class="badge ${getBadgeClass(item.type)}">${item.type}</span></td>
                <td class="row-key-cell">${StorageUtils.escapeHtml(item.key)}</td>
                <td class="row-val-cell truncate" style="opacity: 0.5;">${StorageUtils.escapeHtml(item.value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = html;
}

function getBadgeClass(type) {
  if (type === 'localStorage') return 'badge-local';
  if (type === 'sessionStorage') return 'badge-session';
  if (type === 'indexedDB') return 'badge-indexed';
  return 'badge-cookie';
}

// ==========================================
// STORAGE SET / DELETE METHODS
// ==========================================

function deleteStorageItem(type, key) {
  if (!activeTabId) return;

  if (type === 'cookie') {
    chrome.runtime.sendMessage({
      type: 'REMOVE_COOKIE',
      url: activeTabUrl,
      cookieDetails: { name: key }
    }, (res) => {
      if (res && res.success) {
        fetchStorageSilently();
      } else {
        alert('Failed to remove cookie: ' + (res ? res.error : 'Unknown error'));
      }
    });
  } else {
    chrome.tabs.sendMessage(activeTabId, {
      type: 'REMOVE_STORAGE_ITEM',
      storageType: type,
      key
    }, (res) => {
      if (res && res.success) {
        fetchStorageSilently();
      } else {
        alert('Failed to remove item: ' + (res ? res.error : 'Unknown error'));
      }
    });
  }
}

function setStorageItem(type, key, value, cookieParams = null) {
  if (!activeTabId) return;

  if (type === 'cookie') {
    const details = {
      name: key,
      value: value,
      path: cookieParams ? cookieParams.path : '/',
      secure: cookieParams ? cookieParams.secure : false,
      httpOnly: cookieParams ? cookieParams.httpOnly : false
    };

    if (cookieParams && cookieParams.ttl) {
      details.expirationDate = Date.now() / 1000 + parseInt(cookieParams.ttl);
    }

    chrome.runtime.sendMessage({
      type: 'SET_COOKIE',
      url: activeTabUrl,
      cookieDetails: details
    }, (res) => {
      if (res && res.success) {
        fetchStorageSilently();
      } else {
        alert('Failed to save cookie: ' + (res ? res.error : 'Unknown error'));
      }
    });
  } else {
    chrome.tabs.sendMessage(activeTabId, {
      type: 'SET_STORAGE_ITEM',
      storageType: type,
      key,
      value
    }, (res) => {
      if (res && res.success) {
        fetchStorageSilently();
      } else {
        alert('Failed to save item: ' + (res ? res.error : 'Unknown error'));
      }
    });
  }
}

// ==========================================
// DETAILS / INSPECTOR PANEL
// ==========================================

function initDetailsPanel() {
  els.detailCloseBtn.onclick = () => {
    els.detailDrawer.classList.add('collapsed');
    els.explorerTableBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
    selectedItem = null;
  };

  // Tab switching in detail panel
  const tabs = document.querySelectorAll('.detail-tab-btn');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const panels = document.querySelectorAll('.detail-tab-panel');
      panels.forEach(p => p.classList.remove('active'));
      
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    };
  });

  // Save raw edits
  els.btnSaveRaw.onclick = () => {
    if (!selectedItem) return;
    const newVal = els.detailRawTextarea.value;
    setStorageItem(selectedItem.type, selectedItem.key, newVal);
    // Sync local object and update details panel stats
    selectedItem.value = newVal;
    selectedItem.size = StorageUtils.getByteSize(newVal);
    updateDetailDrawerUI();
  };

  // Copy buttons
  els.btnDetailCopyVal.onclick = () => {
    if (!selectedItem) return;
    navigator.clipboard.writeText(selectedItem.value);
    
    // Smooth transition label feedback
    const originalText = els.btnDetailCopyVal.innerHTML;
    els.btnDetailCopyVal.textContent = 'Copied!';
    setTimeout(() => { els.btnDetailCopyVal.innerHTML = originalText; }, 1500);
  };

  els.btnDetailExport.onclick = () => {
    if (!selectedItem) return;
    StorageUtils.exportData([selectedItem], 'json', `storage_${selectedItem.type}_${selectedItem.key}`);
  };

  // Delete
  els.btnDetailDelete.onclick = () => {
    if (!selectedItem) return;
    if (confirm(`Delete key "${selectedItem.key}"?`)) {
      deleteStorageItem(selectedItem.type, selectedItem.key);
      els.detailDrawer.classList.add('collapsed');
      selectedItem = null;
    }
  };

  // JSON Expand/Collapse
  els.btnJsonExpand.onclick = () => {
    els.detailJsonTreeContainer.querySelectorAll('.json-node').forEach(node => {
      node.classList.remove('collapsed');
      const toggle = node.querySelector('.json-toggle-icon');
      if (toggle) {
        toggle.textContent = '▼';
        toggle.classList.remove('collapsed-icon');
      }
    });
  };

  els.btnJsonCollapse.onclick = () => {
    els.detailJsonTreeContainer.querySelectorAll('.json-node').forEach(node => {
      node.classList.add('collapsed');
      const toggle = node.querySelector('.json-toggle-icon');
      if (toggle) {
        toggle.textContent = '▶';
        toggle.classList.add('collapsed-icon');
      }
    });
  };

  els.btnCopyBase64Decoded.onclick = () => {
    navigator.clipboard.writeText(els.detailBase64Textarea.value);
    const orig = els.btnCopyBase64Decoded.textContent;
    els.btnCopyBase64Decoded.textContent = 'Copied!';
    setTimeout(() => { els.btnCopyBase64Decoded.textContent = orig; }, 1500);
  };
}

function openInspectorPanel(item) {
  selectedItem = item;
  els.detailDrawer.classList.remove('collapsed');
  
  // Set badge and name
  let badgeClass = 'badge-local';
  if (item.type === 'sessionStorage') badgeClass = 'badge-session';
  if (item.type === 'cookie') badgeClass = 'badge-cookie';
  if (item.type === 'indexedDB') badgeClass = 'badge-indexed';
  
  els.detailTypeBadge.className = `badge ${badgeClass}`;
  let typeLabel = 'LS';
  if (item.type === 'sessionStorage') typeLabel = 'SS';
  else if (item.type === 'cookie') typeLabel = 'Cookie';
  else if (item.type === 'indexedDB') typeLabel = 'IDB';
  els.detailTypeBadge.textContent = typeLabel;
  els.detailKeyDisplay.textContent = item.key;
  els.detailKeyDisplay.setAttribute('title', item.key);

  updateDetailDrawerUI();
}

function updateDetailDrawerUI() {
  if (!selectedItem) return;

  const value = selectedItem.value;
  els.detailStatChars.textContent = value.length;
  els.detailStatSize.textContent = StorageUtils.formatBytes(selectedItem.size);

  // Set Raw editor value
  els.detailRawTextarea.value = value;

  // Run scanner warnings and insights
  els.detailAlerts.innerHTML = '';
  const securityWarnings = StorageUtils.scanSecurity(selectedItem.key, value);
  const insights = StorageUtils.scanInsights(selectedItem.key, value);

  securityWarnings.forEach(w => {
    const div = document.createElement('div');
    div.className = 'detail-alert alert-danger';
    div.innerHTML = `<span class="alert-icon">⚠</span> <span>Possible Secret: ${w.info}</span>`;
    els.detailAlerts.appendChild(div);
  });

  insights.forEach(ins => {
    const div = document.createElement('div');
    div.className = 'detail-alert alert-info';
    div.innerHTML = `<span class="alert-icon">ℹ</span> <span><strong>${ins.label} Detected:</strong> ${ins.info}</span>`;
    els.detailAlerts.appendChild(div);
  });

  // Handle Tab Displays based on content type
  const isJSON = insights.some(i => i.type === 'json');
  const isJWT = insights.some(i => i.type === 'jwt');
  const isBase64 = insights.some(i => i.type === 'base64');

  toggleTabBtn('btn-tab-json', isJSON);
  toggleTabBtn('btn-tab-jwt', isJWT);
  toggleTabBtn('btn-tab-base64', isBase64);

  // Default view to Raw Editor at opening
  document.querySelector('.detail-tab-btn[data-tab="tab-raw"]').click();

  // Populate JSON tree if valid
  if (isJSON) {
    const parsed = JSON.parse(value);
    UIComponents.createJSONTree(parsed, els.detailJsonTreeContainer);
  }

  // Populate JWT decode if valid
  if (isJWT) {
    const jwt = StorageUtils.decodeJWT(value);
    if (jwt) {
      UIComponents.createJSONTree(jwt.header, els.detailJwtHeaderTree);
      UIComponents.createJSONTree(jwt.payload, els.detailJwtPayloadTree);
    }
  }

  // Populate Base64 decode
  if (isBase64) {
    const dec = StorageUtils.decodeBase64(value);
    els.detailBase64Textarea.value = dec || 'Decoding error';
  }
}

function toggleTabBtn(id, visible) {
  const btn = document.getElementById(id);
  if (visible) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

// ==========================================
// MODALS MODULE
// ==========================================

function initModals() {
  els.btnAddItem.onclick = () => {
    els.modalTitle.textContent = 'Add Storage Entry';
    els.modalInputKey.value = '';
    els.modalInputKey.disabled = false;
    els.modalInputValue.value = '';
    els.modalInputType.value = 'localStorage';
    els.modalCookieParams.classList.add('hidden');
    els.modalAddEntry.classList.remove('hidden');
  };

  els.modalInputType.onchange = (e) => {
    if (e.target.value === 'cookie') {
      els.modalCookieParams.classList.remove('hidden');
    } else {
      els.modalCookieParams.classList.add('hidden');
    }
  };

  const closeModal = () => {
    els.modalAddEntry.classList.add('hidden');
  };

  els.btnModalClose.onclick = closeModal;
  els.btnModalCancel.onclick = closeModal;

  els.btnModalSave.onclick = () => {
    const type = els.modalInputType.value;
    const key = els.modalInputKey.value.trim();
    const value = els.modalInputValue.value;

    if (!key) {
      alert('Please fill out the Storage Key.');
      return;
    }

    let cookieParams = null;
    if (type === 'cookie') {
      cookieParams = {
        path: els.cookieInputPath.value,
        secure: els.cookieInputSecure.checked,
        httpOnly: els.cookieInputHttp.checked,
        ttl: els.cookieInputExp.value
      };
    }

    setStorageItem(type, key, value, cookieParams);
    closeModal();
  };
}

// ==========================================
// SETTINGS & SIDEBAR NAVIGATION
// ==========================================

function initSidebar() {
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(m => m.classList.remove('active'));
      item.classList.add('active');

      const panels = document.querySelectorAll('.panel');
      panels.forEach(p => p.classList.remove('active'));

      currentPanel = item.getAttribute('data-target');
      document.getElementById(currentPanel).classList.add('active');

      // Update Header Text
      let label = 'Dashboard';
      if (currentPanel === 'panel-explorer') label = 'Storage Explorer';
      else if (currentPanel === 'panel-analytics') label = 'Analytics Diagnostics';
      else if (currentPanel === 'panel-security') label = 'Security Scanner';
      else if (currentPanel === 'panel-snapshots') label = 'Snapshots';
      else if (currentPanel === 'panel-settings') label = 'Configuration Settings';

      els.panelTitle.textContent = label;
      
      // Trigger animations for loaded page components
      if (currentPanel === 'panel-dashboard') renderDashboard();
      if (currentPanel === 'panel-explorer') renderExplorerTable();
      if (currentPanel === 'panel-analytics') renderAnalytics();
      if (currentPanel === 'panel-security') renderSecurityScan();
      if (currentPanel === 'panel-snapshots') renderSnapshotsList();
    });
  });

  // Top header refresh button
  els.btnRefresh.onclick = () => {
    refreshData();
  };
}

function initSettings() {
  // Bind Theme selector
  ThemeSystem.getTheme().then(theme => {
    els.themeSelect.value = theme;
  });
  
  els.themeSelect.onchange = (e) => {
    ThemeSystem.setTheme(e.target.value);
  };

  // Bind Instant Search Input
  let debounceTimeout = null;
  els.explorerSearch.oninput = () => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      renderExplorerTable();
    }, 200); // 200ms debounce
  };

  els.btnClearSearch.onclick = () => {
    els.explorerSearch.value = '';
    renderExplorerTable();
  };

  els.explorerFilterType.onchange = () => renderExplorerTable();
  els.explorerSortBy.onchange = () => renderExplorerTable();

  // Settings switches
  els.settingLiveSync.onchange = (e) => {
    chrome.storage.local.set({ liveSync: e.target.checked }, () => {
      setupPolling();
      const row = document.getElementById('setting-poll-frequency-row');
      if (e.target.checked) row.classList.remove('hidden');
      else row.classList.add('hidden');
    });
  };

  els.settingPollInterval.onchange = (e) => {
    const val = parseInt(e.target.value);
    if (val >= 500) {
      chrome.storage.local.set({ pollInterval: val }, () => {
        setupPolling();
      });
    }
  };

  els.settingExclusions.onchange = (e) => {
    chrome.storage.local.set({ exclusions: e.target.value.trim() }, () => {
      refreshData();
    });
  };

  // Purge snapshot storage
  els.btnPurgeSnapshots.onclick = () => {
    if (confirm('Delete all recorded storage snapshots? This action is irreversible.')) {
      snapshotsList = [];
      chrome.storage.local.set({ snapshots: [] }, () => {
        renderSnapshotsList();
        alert('All snapshots purged.');
      });
    }
  };

  // Wipe tab storage
  els.btnWipeActiveStorage.onclick = () => {
    if (!activeTabId) return;
    if (confirm('Wipe ALL web storage (localStorage, sessionStorage, IndexedDB) and matching cookies on this webpage? This will log you out and clear active sessions.')) {
      // Clear localStorage
      chrome.tabs.sendMessage(activeTabId, { type: 'CLEAR_STORAGE', storageType: 'localStorage' }, () => {
        // Clear sessionStorage
        chrome.tabs.sendMessage(activeTabId, { type: 'CLEAR_STORAGE', storageType: 'sessionStorage' }, () => {
          // Clear IndexedDB
          chrome.tabs.sendMessage(activeTabId, { type: 'CLEAR_STORAGE', storageType: 'indexedDB' }, () => {
            // Clear cookies
            storageData.filter(i => i.type === 'cookie').forEach(c => {
              deleteStorageItem('cookie', c.key);
            });
            alert('Web page storage completely wiped.');
            refreshData();
          });
        });
      });
    }
  };
}
