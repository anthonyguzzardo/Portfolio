# County-Level SVG Heatmap -- Complete Code Reference

Zero external mapping libraries. Just a static SVG, vanilla JS, and CSS transitions.

---

## How It Works

Each county is a `<path>` in a static SVG file. At runtime, JS fetches the SVG, injects it into the DOM, then colors each path based on data. Hovering shows a tooltip, clicking shows a detail panel, and chip buttons toggle which metric drives the colors.

---

## 1. The SVG Asset

You need an SVG file with one `<path>` per region. Each path needs:
- A `data-county` attribute (the region name, used to match against your data)
- A `class="county-path"` (for bulk CSS and JS selection)

Example structure (`/public/assets/nc-counties-map.svg`):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 350">
  <path id="county-wake" data-county="Wake" class="county-path"
    d="M400.5,120.3L402.1,125.8L410.0,130.2...Z" />
  <path id="county-durham" data-county="Durham" class="county-path"
    d="M420.1,105.0L425.3,108.7L430.0,112.5...Z" />
  <!-- one <path> per county -->
</svg>
```

---

## 2. HTML

```html
<!-- Metric Toggle Chips -->
<div class="map-controls">
  <span class="map-control-label">Color by:</span>
  <button class="map-chip active" data-metric="retailers">Retailers</button>
  <button class="map-chip" data-metric="revenue">Revenue</button>
  <button class="map-chip" data-metric="transactions">Transactions</button>
</div>

<!-- Map Container (SVG gets injected here) -->
<div class="county-map" id="county-map">
  <div class="loading-cell">Loading county data...</div>
</div>

<!-- Floating Hover Tooltip -->
<div id="map-tooltip" class="map-tooltip" style="display: none;">
  <div class="tooltip-name" id="tt-name">--</div>
  <div class="tooltip-stats">
    <div class="tooltip-stat">
      <span class="tooltip-label">Retailers</span>
      <span class="tooltip-val" id="tt-retailers">0</span>
    </div>
    <div class="tooltip-stat">
      <span class="tooltip-label">Revenue</span>
      <span class="tooltip-val" id="tt-revenue">$0</span>
    </div>
    <div class="tooltip-stat">
      <span class="tooltip-label">Transactions</span>
      <span class="tooltip-val" id="tt-txns">0</span>
    </div>
    <div class="tooltip-stat">
      <span class="tooltip-label">Active Deals</span>
      <span class="tooltip-val" id="tt-deals">0</span>
    </div>
  </div>
</div>

<!-- Color Legend -->
<div class="map-legend">
  <span class="legend-label">Density:</span>
  <div class="legend-bar">
    <span class="legend-min">0</span>
    <div class="legend-gradient"></div>
    <span class="legend-max" id="legend-max">--</span>
  </div>
</div>

<!-- County Detail Panel (shown on click) -->
<div id="county-detail" class="county-detail" style="display: none;">
  <div class="county-detail-header">
    <h2 class="county-detail-name" id="cd-name">--</h2>
    <button class="county-detail-close" id="cd-close">X</button>
  </div>
  <div class="county-detail-grid">
    <div class="cd-item">
      <div class="cd-label">Retailers</div>
      <div class="cd-value" id="cd-retailers">--</div>
    </div>
    <div class="cd-item">
      <div class="cd-label">Active Deals</div>
      <div class="cd-value" id="cd-deals">--</div>
    </div>
    <div class="cd-item">
      <div class="cd-label">Transactions</div>
      <div class="cd-value" id="cd-transactions">--</div>
    </div>
    <div class="cd-item">
      <div class="cd-label">Revenue</div>
      <div class="cd-value" id="cd-revenue">--</div>
    </div>
    <div class="cd-item">
      <div class="cd-label">Stripe Connected</div>
      <div class="cd-value" id="cd-stripe">--</div>
    </div>
    <div class="cd-item">
      <div class="cd-label">Tax Rate</div>
      <div class="cd-value" id="cd-tax">--</div>
    </div>
  </div>
</div>
```

---

## 3. Complete JavaScript

```javascript
let countyData = [];
let currentMetric = 'retailers';
let svgLoaded = false;

// ── HELPERS ──

function fmtMoney(val) {
  return `$${Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getMetricValue(county, metric) {
  switch (metric) {
    case 'retailers':    return county.retailer_count || 0;
    case 'revenue':      return county.revenue || 0;
    case 'transactions': return county.transaction_count || 0;
    default:             return 0;
  }
}

// ── LOAD SVG INTO DOM ──

async function loadSvgMap(container) {
  if (svgLoaded) return;
  try {
    const res = await fetch('/assets/nc-counties-map.svg');
    if (!res.ok) throw new Error('SVG not found');
    const svgText = await res.text();
    container.innerHTML = `<div class="svg-map-wrap">${svgText}</div>`;
    svgLoaded = true;
  } catch {
    // Falls back to grid if SVG unavailable
    svgLoaded = false;
  }
}

// ── RENDER HEATMAP ──

function renderCountyMap(data, metric) {
  countyData = data;
  const container = document.getElementById('county-map');
  const maxVal = Math.max(...data.map(d => getMetricValue(d, metric)), 1);

  // Update legend max label
  const legendMax = document.getElementById('legend-max');
  if (legendMax) {
    legendMax.textContent = metric === 'revenue' ? fmtMoney(maxVal) : maxVal.toString();
  }

  // Build data lookup by county name
  const dataMap = {};
  data.forEach(c => { dataMap[c.county_name] = c; });

  // ── SVG PATH RENDERING ──
  const svgEl = container.querySelector('svg');
  if (svgEl) {
    // Color each county path based on data
    svgEl.querySelectorAll('.county-path').forEach(path => {
      const countyName = path.dataset.county;
      if (!countyName) return;
      const county = dataMap[countyName];
      const val = county ? getMetricValue(county, metric) : 0;
      const intensity = maxVal > 0 ? val / maxVal : 0;

      if (val > 0) {
        const opacity = Math.max(intensity * 0.85, 0.15);
        path.style.fill = `rgba(196, 34, 36, ${opacity})`;
      } else {
        path.style.fill = 'rgba(255, 255, 255, 0.06)';
      }

      // Remove native <title> tooltip (we use a floating card instead)
      const existingTitle = path.querySelector('title');
      if (existingTitle) existingTitle.remove();
    });

    // ── HOVER + CLICK HANDLERS ──
    const tooltipEl = document.getElementById('map-tooltip');

    svgEl.querySelectorAll('.county-path').forEach(path => {
      // HOVER IN: populate tooltip + scale up county
      path.addEventListener('mouseenter', () => {
        const name = path.dataset.county || '';
        const county = dataMap[name];

        document.getElementById('tt-name').textContent = name + ' County';
        document.getElementById('tt-retailers').textContent = (county?.retailer_count || 0).toString();
        document.getElementById('tt-revenue').textContent = fmtMoney(county?.revenue || 0);
        document.getElementById('tt-txns').textContent = (county?.transaction_count || 0).toString();
        document.getElementById('tt-deals').textContent = (county?.active_deals || 0).toString();

        tooltipEl.style.display = 'block';

        // Scale + glow effect
        path.style.transform = 'scale(1.03)';
        path.style.transformOrigin = 'center';
        path.style.filter = 'brightness(1.4) drop-shadow(0 0 6px rgba(196, 34, 36, 0.5))';
      });

      // HOVER MOVE: reposition tooltip, flip if near viewport edge
      path.addEventListener('mousemove', (e) => {
        const offset = 16;
        let x = e.clientX + offset;
        let y = e.clientY + offset;

        const tw = tooltipEl.offsetWidth;
        const th = tooltipEl.offsetHeight;
        if (x + tw > window.innerWidth - 8) x = e.clientX - tw - offset;
        if (y + th > window.innerHeight - 8) y = e.clientY - th - offset;

        tooltipEl.style.left = x + 'px';
        tooltipEl.style.top = y + 'px';
      });

      // HOVER OUT: hide tooltip, remove scale/glow
      path.addEventListener('mouseleave', () => {
        tooltipEl.style.display = 'none';
        path.style.transform = '';
        path.style.filter = '';
      });

      // CLICK: show detail panel
      path.addEventListener('click', () => {
        const name = path.dataset.county;
        const county = dataMap[name || ''];
        if (county) showCountyDetail(county);
      });
    });

    return;
  }

  // ── FALLBACK: GRID LAYOUT (if SVG failed to load) ──
  const sorted = [...data].sort((a, b) =>
    (a.county_name || '').localeCompare(b.county_name || '')
  );

  container.innerHTML = `<div class="county-grid">${sorted.map(c => {
    const val = getMetricValue(c, metric);
    const intensity = maxVal > 0 ? val / maxVal : 0;
    const opacity = val > 0 ? Math.max(intensity * 0.85, 0.12) : 0.03;
    const hasData = val > 0;
    return `
      <div class="county-cell ${hasData ? 'county-active' : ''}"
           data-county="${escapeHtml(c.county_name)}"
           style="background-color: rgba(196, 34, 36, ${opacity.toFixed(2)})"
           title="${c.county_name}: ${metric === 'revenue' ? fmtMoney(val) : val}">
        <span class="county-name-label">${escapeHtml(c.county_name)}</span>
        ${hasData ? `<span class="county-val">${metric === 'revenue' ? '$' + Math.round(val) : val}</span>` : ''}
      </div>
    `;
  }).join('')}</div>`;

  // Click handlers for grid fallback
  container.querySelectorAll('.county-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const name = cell.dataset.county;
      const county = data.find(c => c.county_name === name);
      if (county) showCountyDetail(county);
    });
  });
}

// ── DETAIL PANEL ──

function showCountyDetail(c) {
  const detail = document.getElementById('county-detail');
  detail.style.display = 'block';

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('cd-name', c.county_name + ' County');
  setEl('cd-retailers', (c.retailer_count || 0).toString());
  setEl('cd-deals', (c.active_deals || 0).toString());
  setEl('cd-transactions', (c.transaction_count || 0).toString());
  setEl('cd-revenue', fmtMoney(c.revenue || 0));
  setEl('cd-stripe', (c.stripe_connected || 0).toString());
  setEl('cd-tax', `${(Number(c.combined_rate || 0) * 100).toFixed(2)}%`);

  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── INIT ──

async function init() {
  const container = document.getElementById('county-map');

  // 1. Load SVG map into DOM
  await loadSvgMap(container);

  // 2. Fetch your data (replace this with your own API/data source)
  const res = await fetch('/api/ops-geo?view=county', {
    headers: { 'x-admin-key': 'YOUR_KEY' },
  });
  if (!res.ok) return;
  const data = await res.json();

  // 3. Render the heatmap
  renderCountyMap(data, currentMetric);

  // 4. Metric toggle chips
  document.querySelectorAll('.map-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const metric = chip.dataset.metric;
      currentMetric = metric;
      document.querySelectorAll('.map-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderCountyMap(data, metric);
    });
  });

  // 5. Close detail panel
  document.getElementById('cd-close')?.addEventListener('click', () => {
    document.getElementById('county-detail').style.display = 'none';
  });
}

init();
```

---

## 4. Complete CSS

```css
/* ── SVG MAP WRAPPER ── */

.svg-map-wrap {
  border: 1px solid var(--color-text-faint);
  background-color: var(--color-surface);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.svg-map-wrap svg {
  width: 100%;
  height: auto;
  max-height: 450px;
}

/* County path transitions -- this is what makes hover smooth */
.svg-map-wrap .county-path {
  stroke: rgba(255, 255, 255, 0.15);
  stroke-width: 0.5;
  cursor: pointer;
  transition: fill 0.2s ease, stroke 0.2s ease, transform 0.2s ease, filter 0.2s ease;
}

.svg-map-wrap .county-path:hover {
  stroke: var(--brand-red);
  stroke-width: 1.5;
}

/* ── MAP CONTAINER ── */

.county-map {
  margin-bottom: var(--space-4);
}

/* ── METRIC TOGGLE CHIPS ── */

.map-controls {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-4);
}

.map-control-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  color: var(--color-text-faint);
  margin-right: var(--space-1);
}

.map-chip {
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-family);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  background: none;
  color: var(--color-text-faint);
  border: 1px solid var(--color-text-faint);
  cursor: pointer;
  transition: all 0.15s ease;
}

.map-chip:hover {
  color: var(--color-text);
  border-color: var(--color-text-soft);
}

.map-chip.active {
  color: var(--brand-red);
  border-color: var(--brand-red);
  background-color: rgba(196, 34, 36, 0.08);
}

/* ── FLOATING TOOLTIP ── */

.map-tooltip {
  position: fixed;
  z-index: 1000;
  pointer-events: none;           /* never blocks clicks on the map */
  background-color: var(--color-surface);
  border: 2px solid var(--brand-red);
  padding: var(--space-3) var(--space-4);
  min-width: 180px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  opacity: 0;
  animation: tooltip-in 0.15s ease forwards;
}

@keyframes tooltip-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.tooltip-name {
  font-weight: var(--font-weight-black);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-2);
  color: var(--color-text);
}

.tooltip-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-1) var(--space-4);
}

.tooltip-stat {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.tooltip-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-soft);
}

.tooltip-val {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--brand-red);
}

/* ── LEGEND ── */

.map-legend {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.legend-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-faint);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}

.legend-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.legend-min, .legend-max {
  font-size: var(--font-size-xs);
  color: var(--color-text-faint);
}

.legend-gradient {
  width: 120px;
  height: 10px;
  background: linear-gradient(to right, rgba(196, 34, 36, 0.05), rgba(196, 34, 36, 0.85));
  border: 1px solid var(--color-text-faint);
}

/* ── COUNTY DETAIL PANEL ── */

.county-detail {
  background-color: var(--color-surface);
  border: var(--border-width-thick) solid var(--brand-red);
  padding: var(--space-6);
  margin-bottom: var(--space-8);
}

.county-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.county-detail-name {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-black);
  margin: 0;
}

.county-detail-close {
  background: none;
  border: 1px solid var(--color-text-faint);
  color: var(--color-text-faint);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: var(--font-family);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-xs);
}

.county-detail-close:hover {
  color: var(--brand-red);
  border-color: var(--brand-red);
}

.county-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-4);
}

.cd-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-faint);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  margin-bottom: var(--space-1);
}

.cd-value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-black);
  color: var(--brand-red);
}

/* ── GRID FALLBACK (if SVG fails to load) ── */

.county-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 2px;
}

.county-cell {
  padding: var(--space-2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
  min-height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.county-cell:hover {
  border-color: var(--brand-red);
  transform: scale(1.05);
  z-index: 2;
  position: relative;
}

.county-active:hover {
  box-shadow: 0 0 12px rgba(196, 34, 36, 0.3);
}

.county-name-label {
  font-size: 9px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-soft);
  line-height: 1.1;
}

.county-val {
  font-size: 11px;
  font-weight: var(--font-weight-black);
  color: var(--color-text);
  margin-top: 2px;
}

/* ── RESPONSIVE ── */

@media (max-width: 768px) {
  .map-controls {
    flex-wrap: wrap;
  }
}

.loading-cell {
  text-align: center;
  color: var(--color-text-soft);
}
```

---

## 5. Data Shape

Your API needs to return an array of objects. Each object represents one county:

```json
[
  {
    "county_name": "Wake",
    "retailer_count": 45,
    "revenue": 12500.00,
    "transaction_count": 320,
    "active_deals": 18,
    "consumer_signups": 89,
    "combined_rate": 0.0725,
    "stripe_connected": 12
  },
  {
    "county_name": "Durham",
    "retailer_count": 0,
    "revenue": 0,
    "transaction_count": 0,
    "active_deals": 0,
    "consumer_signups": 15,
    "combined_rate": 0.075,
    "stripe_connected": 0
  }
]
```

The only required field for the heatmap itself is `county_name` plus whichever metric(s) you want to visualize. Everything else is for the tooltip and detail panel.

---

## 6. Adapting for a Birding App

Swap these concepts:

| Dealifier | Birding App |
|-----------|-------------|
| `retailer_count` | `sighting_count` |
| `revenue` | `species_count` |
| `transaction_count` | `observer_count` |
| `active_deals` | `rare_species` |
| NC counties SVG | Your state/region SVG |
| `rgba(196, 34, 36, ...)` | Your brand color |

The pattern is the same:
1. Get or create an SVG with one `<path data-county="RegionName" class="county-path">` per region
2. Fetch it at runtime, inject into DOM
3. Fetch your data, build a lookup keyed by region name
4. Loop SVG paths, calculate `value / maxValue` for opacity, set `style.fill`
5. CSS transitions handle the smooth hover animations
6. JS handles tooltip positioning and detail panel
