// Theme controller for StorageVault
const ThemeSystem = {
  getTheme: function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['theme'], (result) => {
        resolve(result.theme || 'system');
      });
    });
  },

  setTheme: function(theme) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ theme }, () => {
        this.applyTheme(theme);
        resolve(theme);
      });
    });
  },

  applyTheme: function(theme) {
    const root = document.documentElement;
    let actualTheme = theme;

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      actualTheme = isDark ? 'dark' : 'light';
    }

    root.setAttribute('data-theme', actualTheme);
    
    // Broadcast theme update if options/popup are open in other contexts
    chrome.runtime.sendMessage({
      type: 'THEME_CHANGED',
      theme: theme,
      actualTheme: actualTheme
    }).catch(() => {});
  },

  init: async function() {
    const theme = await this.getTheme();
    this.applyTheme(theme);

    // Watch for system color scheme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const currentTheme = await this.getTheme();
      if (currentTheme === 'system') {
        this.applyTheme('system');
      }
    });

    // Listen for theme changes from other parts of the extension
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'THEME_CHANGED') {
        const root = document.documentElement;
        root.setAttribute('data-theme', message.actualTheme);
        // Sync UI inputs if necessary
        const themeSelector = document.getElementById('theme-select');
        if (themeSelector) {
          themeSelector.value = message.theme;
        }
      }
    });
  }
};

// Initialize theme immediately on script load
ThemeSystem.init();
