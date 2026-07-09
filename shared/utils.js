// Utility functions for StorageVault

const StorageUtils = {
  // Compute exact UTF-8 byte size of a string
  getByteSize: function(str) {
    if (!str) return 0;
    try {
      return new Blob([str]).size;
    } catch (e) {
      // Fallback
      return encodeURIComponent(str).replace(/%[0-9A-F]{2}/g, 'a').length;
    }
  },

  // Format byte size to readable string
  formatBytes: function(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  // Try parsing string as JSON
  tryParseJSON: function(str) {
    if (typeof str !== 'string') return false;
    try {
      const val = JSON.parse(str);
      if (typeof val === 'object' && val !== null) {
        return val;
      }
    } catch (e) {}
    return false;
  },

  // HTML escaping helper
  escapeHtml: function(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Smart Insights Scanner
  scanInsights: function(key, value) {
    const insights = [];
    const lowerKey = key.toLowerCase();
    const valStr = value !== undefined && value !== null ? String(value) : '';
    const cleanVal = valStr.trim();
    
    // Check JSON
    const parsedJSON = this.tryParseJSON(valStr);
    if (parsedJSON) {
      insights.push({
        type: 'json',
        label: 'JSON Object',
        badgeClass: 'badge-local',
        info: 'Valid JSON data. Can be inspected as a interactive tree.'
      });
    }

    // Check UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(cleanVal)) {
      insights.push({
        type: 'uuid',
        label: 'UUID',
        badgeClass: 'badge-local',
        info: 'Universally Unique Identifier.'
      });
    }

    // Check JWT
    const jwtRegex = /^ey[a-zA-Z0-9-_]+\.ey[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/;
    if (jwtRegex.test(cleanVal)) {
      insights.push({
        type: 'jwt',
        label: 'JWT Token',
        badgeClass: 'badge-cookie',
        info: 'JSON Web Token. Likely contains encoded user session details.'
      });
    }

    // Check Base64 (length at least 8 to avoid false positives, matches valid Base64)
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    if (valStr.length >= 8 && base64Regex.test(cleanVal) && !valStr.includes(' ')) {
      // Additional check to avoid plain words being flagged
      if (/[+/=]/.test(valStr) || (valStr.length > 12 && !/^[A-Za-z]+$/.test(valStr))) {
        insights.push({
          type: 'base64',
          label: 'Base64 Encoded',
          badgeClass: 'badge-session',
          info: 'Base64 string. Can be decoded to raw text.'
        });
      }
    }

    // Check Firebase configuration
    if (parsedJSON && (parsedJSON.apiKey || parsedJSON.authDomain || parsedJSON.projectId)) {
      insights.push({
        type: 'firebase',
        label: 'Firebase Config',
        badgeClass: 'badge-local',
        info: 'Firebase web SDK setup parameters.'
      });
    }

    // Check general API Keys & Long Tokens
    if ((lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('auth')) && valStr.length > 20) {
      insights.push({
        type: 'api_key',
        label: 'API/Auth Key',
        badgeClass: 'badge-cookie',
        info: 'Variable named like a key/token with a long payload.'
      });
    }

    return insights;
  },

  // Security Scanner - Check for potential secrets and vulnerabilities
  scanSecurity: function(key, value) {
    const risks = [];
    const lowerKey = key.toLowerCase();
    const valStr = value !== undefined && value !== null ? String(value) : '';
    const cleanVal = valStr.trim();

    // 1. OpenAI Keys
    if (/^sk-[a-zA-Z0-9]{20,}/.test(cleanVal)) {
      risks.push({
        severity: 'critical',
        label: 'OpenAI Secret Key',
        info: 'Exposing OpenAI API keys in frontend storage is a critical security risk!'
      });
    }

    // 2. AWS Keys
    const awsRegex = /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/;
    if (awsRegex.test(cleanVal)) {
      risks.push({
        severity: 'critical',
        label: 'AWS Access Key ID',
        info: 'AWS credentials found. Attackers can hijack your AWS infrastructure.'
      });
    }

    // 3. GitHub Tokens
    if (/^gh[oprs]_[a-zA-Z0-9]{36}/.test(cleanVal)) {
      risks.push({
        severity: 'critical',
        label: 'GitHub Personal Access Token',
        info: 'GitHub token detected. Grants access to code repositories.'
      });
    }

    // 4. Google API Keys
    if (/^AIzaSy[a-zA-Z0-9-_]{35}/.test(cleanVal)) {
      risks.push({
        severity: 'high',
        label: 'Google Cloud API Key',
        info: 'Google API key found. Check restrictions on Google Cloud Console.'
      });
    }

    // 5. Passwords in plain text
    if (lowerKey.includes('password') || lowerKey.includes('passwd') || lowerKey.includes('secret')) {
      if (cleanVal.length > 0 && cleanVal.length < 50) {
        risks.push({
          severity: 'high',
          label: 'Plaintext Secret/Password',
          info: 'Sensitive credential storage key contains plaintext values.'
        });
      }
    }

    // 6. Bearer Tokens
    if (/^Bearer\s+[a-zA-Z0-9-_=.]+/i.test(cleanVal)) {
      risks.push({
        severity: 'medium',
        label: 'Bearer Authorization Token',
        info: 'Active authentication header token stored in client storage.'
      });
    }

    // 7. JWT check in keys named session/auth
    if (this.scanInsights(key, valStr).some(ins => ins.type === 'jwt')) {
      if (lowerKey.includes('auth') || lowerKey.includes('session') || lowerKey.includes('user')) {
        // JWT is common, but it's good to remind developers not to put sensitive credentials inside it
        risks.push({
          severity: 'info',
          label: 'JWT Auth Session',
          info: 'JWT stored. Verify it has short expiration (exp) and contains no secrets.'
        });
      }
    }

    return risks;
  },

  // JWT Decoder helper
  decodeJWT: function(jwtStr) {
    try {
      const parts = jwtStr.split('.');
      if (parts.length !== 3) return null;
      
      const headerDec = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
      const payloadDec = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      
      return {
        header: JSON.parse(headerDec),
        payload: JSON.parse(payloadDec)
      };
    } catch (e) {
      return null;
    }
  },

  // Base64 Decoder helper
  decodeBase64: function(str) {
    try {
      return atob(str.trim().replace(/-/g, '+').replace(/_/g, '/'));
    } catch (e) {
      return null;
    }
  },

  // Find duplicates in all storage items
  findDuplicates: function(items) {
    const valueMap = {};
    const duplicates = [];

    items.forEach(item => {
      if (!item.value) return;
      if (!valueMap[item.value]) {
        valueMap[item.value] = [];
      }
      valueMap[item.value].push(item);
    });

    for (const [val, list] of Object.entries(valueMap)) {
      if (list.length > 1) {
        duplicates.push({
          value: val,
          items: list
        });
      }
    }
    return duplicates;
  },

  // Identify unused keys (empty values, dummy keys, etc.)
  findUnusedKeys: function(items) {
    const unused = [];
    const suspiciousKeys = ['temp', 'tmp', 'test', 'dummy', 'todo', 'check', 'foo', 'bar'];

    items.forEach(item => {
      const lowerKey = item.key.toLowerCase();
      const isEmpty = !item.value || item.value.trim() === '' || item.value === '{}' || item.value === '[]';
      const isSuspiciousName = suspiciousKeys.some(k => lowerKey === k || lowerKey.startsWith(k + '_') || lowerKey.endsWith('_' + k));

      if (isEmpty || isSuspiciousName) {
        unused.push({
          item,
          reason: isEmpty ? 'Value is empty or blank container' : 'Matches temporary placeholder naming'
        });
      }
    });

    return unused;
  },

  // Calculate overall storage health and recommendations
  calculateHealthScore: function(items, duplicates, unused, securityRisksCount) {
    let score = 100;
    const recommendations = [];

    // 1. Security risks are heavily penalized
    if (securityRisksCount > 0) {
      const penalty = Math.min(40, securityRisksCount * 15);
      score -= penalty;
      recommendations.push({
        priority: 'high',
        text: `Resolve ${securityRisksCount} potential security secrets exposed in client storage.`
      });
    }

    // 2. Size penalties
    let totalSize = items.reduce((acc, curr) => acc + (curr.size || 0), 0);
    const largeEntries = items.filter(item => (item.size || 0) > 100 * 1024); // > 100KB
    if (largeEntries.length > 0) {
      score -= Math.min(15, largeEntries.length * 5);
      recommendations.push({
        priority: 'medium',
        text: `Compress or migrate ${largeEntries.length} items larger than 100KB to server database.`
      });
    }

    // 3. Duplicate values
    if (duplicates.length > 0) {
      score -= Math.min(15, duplicates.length * 4);
      recommendations.push({
        priority: 'low',
        text: `Consolidate ${duplicates.length} duplicate storage values to save space.`
      });
    }

    // 4. Unused / Temp Keys
    if (unused.length > 0) {
      score -= Math.min(10, unused.length * 2);
      recommendations.push({
        priority: 'low',
        text: `Clean up ${unused.length} empty or temporary debug keys.`
      });
    }

    // Ensure score boundaries
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      grade: score >= 90 ? 'A' : (score >= 75 ? 'B' : (score >= 50 ? 'C' : 'F')),
      recommendations: recommendations.sort((a, b) => {
        const priorities = { high: 3, medium: 2, low: 1 };
        return priorities[b.priority] - priorities[a.priority];
      })
    };
  },

  // Take Snapshot of storage items
  createSnapshot: function(items, label) {
    return {
      id: 'snap_' + Date.now(),
      timestamp: Date.now(),
      label: label || `Snapshot ${new Date().toLocaleString()}`,
      items: items.map(i => ({
        key: i.key,
        value: i.value,
        type: i.type,
        size: i.size
      }))
    };
  },

  // Compare two snapshots
  compareSnapshots: function(oldSnap, newSnap) {
    const oldMap = new Map(oldSnap.items.map(i => [
      i.type + '::' + i.key,
      i.value !== undefined && i.value !== null ? String(i.value) : ''
    ]));
    const newMap = new Map(newSnap.items.map(i => [
      i.type + '::' + i.key,
      i.value !== undefined && i.value !== null ? String(i.value) : ''
    ]));

    const added = [];
    const deleted = [];
    const modified = [];

    // Check for added & modified
    newSnap.items.forEach(item => {
      const compoundKey = item.type + '::' + item.key;
      const stringVal = item.value !== undefined && item.value !== null ? String(item.value) : '';
      if (!oldMap.has(compoundKey)) {
        added.push({
          ...item,
          value: stringVal
        });
      } else if (oldMap.get(compoundKey) !== stringVal) {
        modified.push({
          ...item,
          value: stringVal,
          oldValue: oldMap.get(compoundKey)
        });
      }
    });

    // Check for deleted
    oldSnap.items.forEach(item => {
      const compoundKey = item.type + '::' + item.key;
      const stringVal = item.value !== undefined && item.value !== null ? String(item.value) : '';
      if (!newMap.has(compoundKey)) {
        deleted.push({
          ...item,
          value: stringVal
        });
      }
    });

    return { added, deleted, modified };
  },

  // Export exporters
  exportData: function(items, format, filename = 'storage_vault_export') {
    let content = '';
    let mimeType = 'text/plain';
    let ext = 'txt';

    if (format === 'json') {
      content = JSON.stringify(items, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    } 
    
    else if (format === 'csv') {
      mimeType = 'text/csv';
      ext = 'csv';
      const headers = ['Type', 'Key', 'Value', 'Approx Size (Bytes)'];
      const rows = items.map(item => [
        item.type,
        `"${item.key.replace(/"/g, '""')}"`,
        `"${String(item.value).replace(/"/g, '""')}"`,
        item.size || 0
      ]);
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } 
    
    else {
      // txt
      content = `STORAGEVAULT EXPORT REPORT\n`;
      content += `Generated: ${new Date().toLocaleString()}\n`;
      content += `Total Items: ${items.length}\n`;
      content += `==================================================\n\n`;
      
      items.forEach((item, index) => {
        content += `${index + 1}. [${item.type.toUpperCase()}] Key: ${item.key}\n`;
        content += `   Size: ${this.formatBytes(item.size || 0)}\n`;
        content += `   Value: ${item.value}\n`;
        content += `--------------------------------------------------\n`;
      });
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }
};
