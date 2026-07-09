// Premium UI Components for StorageVault

const UIComponents = {
  // Collapsible JSON Tree Viewer
  createJSONTree: function(data, parentElement, isRoot = true) {
    if (isRoot) {
      parentElement.innerHTML = '';
      parentElement.className = 'json-tree-container';
    }

    const typeofData = typeof data;

    if (data === null) {
      this.renderPrimitive(parentElement, 'null', 'null');
    } else if (typeofData === 'boolean') {
      this.renderPrimitive(parentElement, 'boolean', data ? 'true' : 'false');
    } else if (typeofData === 'number') {
      this.renderPrimitive(parentElement, 'number', String(data));
    } else if (typeofData === 'string') {
      this.renderPrimitive(parentElement, 'string', `"${this.escapeHtml(data)}"`);
    } else if (Array.isArray(data)) {
      this.renderArray(parentElement, data);
    } else if (typeofData === 'object') {
      this.renderObject(parentElement, data);
    }
  },

  escapeHtml: function(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  renderPrimitive: function(parent, type, valueString) {
    const span = document.createElement('span');
    span.className = `json-val json-val-${type}`;
    span.innerHTML = valueString;
    parent.appendChild(span);
  },

  renderArray: function(parent, arr) {
    const wrapper = document.createElement('div');
    wrapper.className = 'json-node json-collapsible';
    
    // Header (Toggle and opening bracket)
    const header = document.createElement('div');
    header.className = 'json-node-header';
    header.innerHTML = `
      <span class="json-toggle-icon">▼</span>
      <span class="json-bracket">[</span>
      <span class="json-count-badge">${arr.length} items</span>
      <span class="json-collapsed-summary">... ]</span>
    `;
    
    // Body (Children)
    const body = document.createElement('div');
    body.className = 'json-node-body';
    
    arr.forEach((item, index) => {
      const line = document.createElement('div');
      line.className = 'json-node-line';
      
      const indexSpan = document.createElement('span');
      indexSpan.className = 'json-key json-index';
      indexSpan.textContent = `${index}: `;
      line.appendChild(indexSpan);
      
      const valContainer = document.createElement('span');
      line.appendChild(valContainer);
      this.createJSONTree(item, valContainer, false);
      
      // Add trailing comma if not last
      if (index < arr.length - 1) {
        const comma = document.createElement('span');
        comma.className = 'json-comma';
        comma.textContent = ',';
        line.appendChild(comma);
      }
      
      body.appendChild(line);
    });

    // Closing bracket
    const footer = document.createElement('div');
    footer.className = 'json-node-footer';
    footer.innerHTML = `<span class="json-bracket">]</span>`;

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    wrapper.appendChild(footer);
    parent.appendChild(wrapper);

    // Click handler for collapsing
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      wrapper.classList.toggle('collapsed');
      const toggle = header.querySelector('.json-toggle-icon');
      if (wrapper.classList.contains('collapsed')) {
        toggle.textContent = '▶';
        toggle.classList.add('collapsed-icon');
      } else {
        toggle.textContent = '▼';
        toggle.classList.remove('collapsed-icon');
      }
    });
  },

  renderObject: function(parent, obj) {
    const wrapper = document.createElement('div');
    wrapper.className = 'json-node json-collapsible';
    
    const keys = Object.keys(obj);
    
    // Header (Toggle and opening brace)
    const header = document.createElement('div');
    header.className = 'json-node-header';
    header.innerHTML = `
      <span class="json-toggle-icon">▼</span>
      <span class="json-bracket">{</span>
      <span class="json-count-badge">${keys.length} keys</span>
      <span class="json-collapsed-summary">... }</span>
    `;
    
    // Body (Children)
    const body = document.createElement('div');
    body.className = 'json-node-body';
    
    keys.forEach((key, index) => {
      const line = document.createElement('div');
      line.className = 'json-node-line';
      
      const keySpan = document.createElement('span');
      keySpan.className = 'json-key';
      keySpan.textContent = `"${key}": `;
      line.appendChild(keySpan);
      
      const valContainer = document.createElement('span');
      line.appendChild(valContainer);
      this.createJSONTree(obj[key], valContainer, false);
      
      // Add trailing comma if not last
      if (index < keys.length - 1) {
        const comma = document.createElement('span');
        comma.className = 'json-comma';
        comma.textContent = ',';
        line.appendChild(comma);
      }
      
      body.appendChild(line);
    });

    // Closing brace
    const footer = document.createElement('div');
    footer.className = 'json-node-footer';
    footer.innerHTML = `<span class="json-bracket">}</span>`;

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    wrapper.appendChild(footer);
    parent.appendChild(wrapper);

    // Click handler for collapsing
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      wrapper.classList.toggle('collapsed');
      const toggle = header.querySelector('.json-toggle-icon');
      if (wrapper.classList.contains('collapsed')) {
        toggle.textContent = '▶';
        toggle.classList.add('collapsed-icon');
      } else {
        toggle.textContent = '▼';
        toggle.classList.remove('collapsed-icon');
      }
    });
  },

  // Donut SVG Pie Chart
  renderPieChart: function(containerEl, data) {
    containerEl.innerHTML = '';
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
      containerEl.innerHTML = `
        <div class="empty-chart">
          <svg viewBox="0 0 100 100" class="empty-chart-svg">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-color)" stroke-width="8"></circle>
          </svg>
          <div class="empty-chart-text">No data available</div>
        </div>
      `;
      return;
    }

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "pie-chart-svg");

    let accumulatedAngle = 0;
    const r = 35;
    const cx = 50;
    const cy = 50;

    data.forEach((slice) => {
      const percentage = slice.value / total;
      const angle = percentage * 360;
      
      if (percentage === 0) return;

      if (percentage === 1) {
        // Full circle
        const circle = document.createElementNS(svgNs, "circle");
        circle.setAttribute("cx", String(cx));
        circle.setAttribute("cy", String(cy));
        circle.setAttribute("r", String(r));
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", slice.color);
        circle.setAttribute("stroke-width", "12");
        svg.appendChild(circle);
        return;
      }

      // Calculate path coordinates
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      
      const radStart = (startAngle - 90) * Math.PI / 180;
      const radEnd = (endAngle - 90) * Math.PI / 180;

      const x1 = cx + r * Math.cos(radStart);
      const y1 = cy + r * Math.sin(radStart);
      const x2 = cx + r * Math.cos(radEnd);
      const y2 = cy + r * Math.sin(radEnd);

      const largeArc = angle > 180 ? 1 : 0;

      // Donut segment stroke trick
      const path = document.createElementNS(svgNs, "path");
      const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
      
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", slice.color);
      path.setAttribute("stroke-width", "12");
      path.setAttribute("stroke-linecap", "round");
      
      // Calculate length for draw-in animation
      const length = Math.PI * 2 * r * percentage;
      path.style.strokeDasharray = `${length} ${2 * Math.PI * r}`;
      path.style.strokeDashoffset = String(length);
      path.style.transition = "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)";
      
      svg.appendChild(path);
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        path.style.strokeDashoffset = "0";
      });

      accumulatedAngle += angle;
    });

    // Add middle text overlay (Donut center)
    const textGroup = document.createElementNS(svgNs, "g");
    textGroup.setAttribute("class", "chart-text-group");

    const textNum = document.createElementNS(svgNs, "text");
    textNum.setAttribute("x", "50");
    textNum.setAttribute("y", "47");
    textNum.setAttribute("text-anchor", "middle");
    textNum.setAttribute("class", "chart-text-num");
    textNum.textContent = String(data.reduce((acc, curr) => acc + curr.count, 0));

    const textLabel = document.createElementNS(svgNs, "text");
    textLabel.setAttribute("x", "50");
    textLabel.setAttribute("y", "62");
    textLabel.setAttribute("text-anchor", "middle");
    textLabel.setAttribute("class", "chart-text-label");
    textLabel.textContent = "Items";

    textGroup.appendChild(textNum);
    textGroup.appendChild(textLabel);
    svg.appendChild(textGroup);

    containerEl.appendChild(svg);
  },

  // Horizontal Size Bar Chart
  renderBarChart: function(containerEl, items, onClickItemCallback) {
    containerEl.innerHTML = '';
    
    if (items.length === 0) {
      containerEl.innerHTML = `<div class="empty-chart-text">No items found for size analysis.</div>`;
      return;
    }

    const maxSize = Math.max(...items.map(i => i.size || 0));

    items.forEach((item) => {
      const percentage = maxSize > 0 ? ((item.size || 0) / maxSize) * 100 : 0;
      const barWrapper = document.createElement('div');
      barWrapper.className = 'bar-chart-row';
      barWrapper.setAttribute('title', `Click to view: ${item.key}`);
      
      // Color-coding prefix class based on type
      let typeClass = 'bar-type-local';
      if (item.type === 'sessionStorage') typeClass = 'bar-type-session';
      if (item.type === 'cookie') typeClass = 'bar-type-cookie';

      barWrapper.innerHTML = `
        <div class="bar-info">
          <span class="bar-key-name truncate">${this.escapeHtml(item.key)}</span>
          <span class="bar-size-value">${StorageUtils.formatBytes(item.size || 0)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${typeClass}" style="width: 0%;"></div>
        </div>
      `;

      if (onClickItemCallback) {
        barWrapper.addEventListener('click', () => onClickItemCallback(item));
      }

      containerEl.appendChild(barWrapper);
      
      // Animate width
      setTimeout(() => {
        const fill = barWrapper.querySelector('.bar-fill');
        if (fill) fill.style.width = `${percentage}%`;
      }, 50);
    });
  },

  // Storage Heatmap Grid
  renderHeatmap: function(containerEl, items, onClickItemCallback) {
    containerEl.innerHTML = '';
    
    if (items.length === 0) {
      containerEl.innerHTML = `<div class="empty-chart-text">No storage items to map.</div>`;
      return;
    }

    const heatmapGrid = document.createElement('div');
    heatmapGrid.className = 'heatmap-grid';
    
    // Sort items by size descending
    const sorted = [...items].sort((a, b) => (b.size || 0) - (a.size || 0));
    const maxSize = sorted[0].size || 1;
    
    sorted.forEach((item) => {
      const size = item.size || 0;
      const cell = document.createElement('div');
      cell.className = `heatmap-cell heatmap-${item.type}`;
      
      // Scale block size (flex-basis/weight) based on size relative to max
      // Using opacity or color intensity for size, and grid tile sizes
      const intensity = maxSize > 0 ? (size / maxSize) : 0;
      
      // Determine background color opacity
      let baseColor = 'rgba(59, 130, 246, ';
      if (item.type === 'sessionStorage') baseColor = 'rgba(16, 185, 129, ';
      if (item.type === 'cookie') baseColor = 'rgba(249, 115, 22, ';
      
      // Min opacity of 0.2, max 1.0
      const opacity = 0.2 + intensity * 0.8;
      cell.style.backgroundColor = baseColor + opacity + ')';
      
      // Tooltip content
      cell.setAttribute('title', `${item.key}\n[${item.type}] - ${StorageUtils.formatBytes(size)}`);
      
      // Text abbreviation for labels if large enough
      if (size > maxSize * 0.15 && item.key.length > 2) {
        cell.textContent = item.key.substring(0, 4) + '..';
      }

      if (onClickItemCallback) {
        cell.addEventListener('click', () => onClickItemCallback(item));
      }

      heatmapGrid.appendChild(cell);
    });

    containerEl.appendChild(heatmapGrid);
  },

  // Radial / Circle Gauge for total space usage
  renderStorageGauge: function(containerEl, usedBytes, maxBytes = 5 * 1024 * 1024) {
    containerEl.innerHTML = '';
    const percentage = Math.min(100, Math.max(0, (usedBytes / maxBytes) * 100));

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "gauge-svg");

    const r = 40;
    const cx = 50;
    const cy = 50;
    const circumference = 2 * Math.PI * r;
    
    // Background Track
    const bgCircle = document.createElementNS(svgNs, "circle");
    bgCircle.setAttribute("cx", String(cx));
    bgCircle.setAttribute("cy", String(cy));
    bgCircle.setAttribute("r", String(r));
    bgCircle.setAttribute("fill", "none");
    bgCircle.setAttribute("stroke", "var(--border-color)");
    bgCircle.setAttribute("stroke-width", "8");
    svg.appendChild(bgCircle);

    // Active Indicator Ring
    const fgCircle = document.createElementNS(svgNs, "circle");
    fgCircle.setAttribute("cx", String(cx));
    fgCircle.setAttribute("cy", String(cy));
    fgCircle.setAttribute("r", String(r));
    fgCircle.setAttribute("fill", "none");
    
    // Set dynamic color based on gauge level
    let strokeColor = "var(--color-success)";
    if (percentage > 85) strokeColor = "var(--color-danger)";
    else if (percentage > 50) strokeColor = "var(--color-warning)";
    
    fgCircle.setAttribute("stroke", strokeColor);
    fgCircle.setAttribute("stroke-width", "8");
    fgCircle.setAttribute("stroke-linecap", "round");
    fgCircle.setAttribute("transform", "rotate(-90 50 50)"); // start at top
    
    fgCircle.style.strokeDasharray = String(circumference);
    fgCircle.style.strokeDashoffset = String(circumference);
    fgCircle.style.transition = "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)";
    
    svg.appendChild(fgCircle);

    // Dynamic Text overlays
    const textGroup = document.createElementNS(svgNs, "g");
    textGroup.setAttribute("class", "gauge-text-group");

    const textNum = document.createElementNS(svgNs, "text");
    textNum.setAttribute("x", "50");
    textNum.setAttribute("y", "48");
    textNum.setAttribute("text-anchor", "middle");
    textNum.setAttribute("class", "gauge-text-num");
    textNum.textContent = percentage.toFixed(1) + "%";

    const textLabel = document.createElementNS(svgNs, "text");
    textLabel.setAttribute("x", "50");
    textLabel.setAttribute("y", "64");
    textLabel.setAttribute("text-anchor", "middle");
    textLabel.setAttribute("class", "gauge-text-label");
    textLabel.textContent = "Quota Used";

    textGroup.appendChild(textNum);
    textGroup.appendChild(textLabel);
    svg.appendChild(textGroup);

    containerEl.appendChild(svg);

    // Trigger animation
    requestAnimationFrame(() => {
      const offset = circumference - (percentage / 100) * circumference;
      fgCircle.style.strokeDashoffset = String(offset);
    });
  }
};
