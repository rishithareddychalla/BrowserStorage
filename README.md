# 🛡️ StorageVault — Advanced Browser Storage Explorer

StorageVault is a premium, developer-grade Chrome Extension (Manifest V3) for inspecting, editing, monitoring, and auditing browser storage. It provides high-fidelity diagnostic visualizations, real-time sync listeners, and security scanning.

Designed with a sleek **Vercel-inspired glassmorphism user interface**, StorageVault replaces the default, basic DevTools storage panels with an analytical workspace.

---

## ✨ Features

- **🌐 Consolidated Unified Inspector:** Inspect `localStorage`, `sessionStorage`, and `cookies` in one interface, grouped, sorted, and filtered on the fly.
- **⚡ Live Synced Updates:** Storage modifications made by the webpage are captured in real-time using a Main World hook and reflected instantly with smooth row highlights.
- **🧬 Deep Diagnostics & Data Analytics:**
  - Dynamic Pie Chart illustrating storage volume allocation.
  - Horizontally scaled Bar Charts showing the largest memory-hogging keys.
  - Custom Storage Heatmap highlighting memory density.
  - Interactive rolling history Timeline of storage modifications.
- **🔒 Active Security Audits:** Automatic analysis of all storage entries for hardcoded API keys, OAuth tokens, JSON Web Tokens (JWT), OpenAI, AWS, and GitHub secrets.
- **🧠 Rich Decoding Utilities:**
  - Collapsible interactive JSON tree viewer.
  - Automated JWT decoder revealing payload and header signatures.
  - Base64 encoder/decoder panel.
- **📸 Storage Snapshots & Differential Engine:**
  - Create full storage snap states.
  - Run differential compares (`A - B`) displaying added, deleted, and modified values.
- **🌓 Adaptive Theme Engine:** Supports Light and Dark modes with custom variables, smooth transitions, and premium fonts.

---

## 🛠️ Architecture & Core Files

```
StorageVault/
├── manifest.json            # Manifest V3 configuration with appropriate permissions
├── background.js           # Background service worker coordinating cookie operations
├── content.js              # Message bridge injecting hooks and relaying runtime events
├── inject.js               # Main-world script hooking window.Storage prototypes
├── generate_icons.py       # Python script using Pillow to render premium 3D assets
├── icons/                  # Output storage for extension icon sizes
├── shared/                 # Common dependencies shared by Popup and Options
│   ├── theme.css           # Premium global token variables & animations
│   ├── theme.js            # Light/Dark controller persistence
│   ├── utils.js            # Unified size calculations, decoders, and security scanner
│   └── components.js       # SVG Charts, JSON viewer tree nodes, and Gauges
├── options/                # Main dashboard tab
│   ├── options.html        # Glassmorphic layout grid
│   ├── options.css         # Options styling sheet
│   └── options.js          # Controller connecting state, updates, and events
└── popup/                  # Browser toolbar popup view
    ├── popup.html          # Compact dashboard and instant search
    ├── popup.css           # Toolbar styling rules
    └── popup.js            # Controller managing quick list and quick deletions
```

---

## 🚀 Getting Started / Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/StorageVault.git
   ```
2. Open your Google Chrome browser and navigate to the extensions management page:
   - Enter `chrome://extensions/` in the URL search bar.
3. Enable **Developer mode** in the top right corner.
4. Click on the **Load unpacked** button in the top left.
5. Select the `C:\Vscode\COSC\BrowserStorage` directory from your local drive.
6. Pin **StorageVault** to your browser toolbar!

---

## 💡 How To Use

### QuickView Popup
Clicking the extension icon opens a popup showing:
- Active website host.
- Unified counters and storage segmented progress bar.
- Search filter and recent key list.
- Click a key in the list to copy it; click the delete icon to remove it.
- Click **Open Advanced Dashboard** to view the full workspace.

### Workspace Dashboard
Open the dashboard by clicking the extension icon and selecting **Open Advanced Dashboard**.
1. **Connected Tab Selection:** In the status box, click the select dropdown to instantly switch the dashboard inspector context between any active browser tab.
2. **Interactive Search:** In the Explorer tab, type keywords. Row contents matching keys or values will highlight instantly.
3. **Data Modifiers:** Click any row to open the side inspector panel. Edit values, parse JSON trees, decode JWT payloads, or delete entries.
4. **Snapshots Compare:** Take snapshots on the Snapshots panel, choose two snapshots, and click **Compare** to inspect exactly what changed.

---

## 🔐 Permissions and Security

StorageVault requests the following permissions under Manifest V3 guidelines:
- `storage`: Persists snapshots, themes, and configuration exclusions.
- `cookies`: Reads and modifies page-level cookies.
- `activeTab` & `scripting`: Dynamically executes message listeners and injection hooks on target webpage domains.

No data is sent to external servers. All processing is executed locally.
