(function() {
  // Prevent double injection
  if (window.__storage_vault_injected__) return;
  window.__storage_vault_injected__ = true;

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;

  function notifyChange(storageType, action, key, newValue, oldValue) {
    window.dispatchEvent(new CustomEvent('__storage_vault_change__', {
      detail: {
        storageType,
        action,
        key,
        newValue,
        oldValue,
        timestamp: Date.now()
      }
    }));
  }

  Storage.prototype.setItem = function(key, value) {
    try {
      const storageType = this === window.localStorage ? 'localStorage' : 'sessionStorage';
      const oldValue = this.getItem(key);
      originalSetItem.apply(this, arguments);
      const newValue = String(value);
      if (oldValue !== newValue) {
        notifyChange(storageType, oldValue === null ? 'add' : 'edit', key, newValue, oldValue);
      }
    } catch (e) {
      originalSetItem.apply(this, arguments);
    }
  };

  Storage.prototype.removeItem = function(key) {
    try {
      const storageType = this === window.localStorage ? 'localStorage' : 'sessionStorage';
      const oldValue = this.getItem(key);
      const exists = oldValue !== null;
      originalRemoveItem.apply(this, arguments);
      if (exists) {
        notifyChange(storageType, 'delete', key, null, oldValue);
      }
    } catch (e) {
      originalRemoveItem.apply(this, arguments);
    }
  };

  Storage.prototype.clear = function() {
    try {
      const storageType = this === window.localStorage ? 'localStorage' : 'sessionStorage';
      const beforeLength = this.length;
      originalClear.apply(this, arguments);
      if (beforeLength > 0) {
        notifyChange(storageType, 'clear', null, null, null);
      }
    } catch (e) {
      originalClear.apply(this, arguments);
    }
  };
})();
