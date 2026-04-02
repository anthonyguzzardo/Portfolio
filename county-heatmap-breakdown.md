# County-Level SVG Heatmap -- How It Works

A breakdown of the geo-intel county heatmap from `src/pages/ops/geo.astro`. Zero external mapping libraries -- just a static SVG, vanilla JS, and CSS transitions.

---

## The Core Idea

Each NC county is a `<path>` in a hand-drawn SVG file (`/public/assets/nc-counties-map.svg`). At runtime, JS fetches that SVG, injects it into the DOM, then colors each county path based on real data. The result is an interactive heatmap with hover tooltips, click-to-detail, and togglable metrics.

---

## SVG Structure

The SVG lives at `/public/assets/nc-counties-map.svg` with a `viewBox="0 0 800 350"`.

Each county is a path like:

```xml
<path id="county-alamance" data-county="Alamance" class="county-path"
  d="M455.2,91.9L455.1,100.3L455.7,101.0...Z" />
```

Key attributes:
- `data-county` -- the county name, used to match against backend data
- `class="county-path"` -- used for bulk styling and JS selection

Default fill is `#e8e8e8` with `stroke: #999; stroke-width: 0.5`.

---

## Loading the SVG

The SVG is fetched at runtime and injected directly into the page so JS can manipulate individual paths:

```javascript
async function loadSvgMap(container) {
  const res = await fetch('/assets/nc-counties-map.svg');
  const svgText = await res.text();
  container.innerHTML = `<div class="svg-map-wrap">${svgText}</div>`;
}
```

If the fetch fails, a CSS grid fallback renders each county as a `div.county-cell` instead.

---

## Color Calculation

The heatmap intensity is relative -- the county with the highest value gets the deepest color, everything else scales proportionally.

```javascript
// Find the max value across all counties for the selected metric
const maxVal = Math.max(...data.map(d => getMetricValue(d, metric)), 1);

// For each county:
const intensity = maxVal > 0 ? value / maxVal : 0;
const opacity = Math.max(intensity * 0.85, 0.15);
```

Color application:
- **Has data:** `rgba(196, 34, 36, opacity)` -- brand red at 15%-85% opacity
- **No data:** `rgba(255, 255, 255, 0.06)` -- barely visible ghost outline

The user can toggle between three metrics via chip buttons: **Retailers**, **Revenue**, **Transactions**. Switching recalculates all colors instantly.

### Legend

A gradient bar at the bottom shows the scale:

```css
background: linear-gradient(to right, rgba(196, 34, 36, 0.05), rgba(196, 34, 36, 0.85));
```

Min (0) and max labels update dynamically based on the current metric.

---

## Animations & Transitions

### County Hover (CSS + JS)

```css
.svg-map-wrap .county-path {
  transition: fill 0.2s ease, stroke 0.2s ease, transform 0.2s ease, filter 0.2s ease;
}
```

On `mouseenter`, JS applies:
```javascript
path.style.transform = 'scale(1.03)';
path.style.transformOrigin = 'center';
path.style.filter = 'brightness(1.4) drop-shadow(0 0 6px rgba(196, 34, 36, 0.5))';
```

The stroke also changes: `stroke: var(--brand-red); stroke-width: 1.5;`

On `mouseleave`, everything reverts (the CSS transition handles the smooth fade).

### Tooltip Entrance

```css
@keyframes tooltip-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Applied with `animation: tooltip-in 0.15s ease forwards`.

### Grid Fallback Hover

```css
.county-cell:hover {
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(196, 34, 36, 0.3);
  transition: all 0.15s ease;
}
```

---

## Interactivity

### Hover Tooltip

A floating tooltip follows the cursor with a 16px offset. It repositions to stay on-screen:

```javascript
let x = e.clientX + 16;
let y = e.clientY + 16;

// Flip if it would overflow the viewport
if (x + tooltipEl.offsetWidth > window.innerWidth - 8)
  x = e.clientX - tooltipEl.offsetWidth - 16;
if (y + tooltipEl.offsetHeight > window.innerHeight - 8)
  y = e.clientY - tooltipEl.offsetHeight - 16;
```

Tooltip shows: County Name, Retailers, Revenue, Transactions, Active Deals.

Has `pointer-events: none` so it never blocks clicks.

### Click-to-Detail

Clicking a county opens a detail panel with extended metrics (retailers, deals, transactions, revenue, Stripe connected count, tax rate). The panel scrolls into view smoothly:

```javascript
detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
```

### Metric Toggle

Three `.map-chip` buttons let the user switch what the heatmap visualizes. Active chip gets a red border/background tint. On click, the entire map re-renders with the new metric's colors.

---

## Data Flow

```
Browser loads page
  |
  v
Parallel API calls (authenticated with x-admin-key header):
  /api/ops-geo?view=county    --> Supabase RPC: get_ops_geo_by_county
  /api/ops-geo?view=zipcode   --> Supabase RPC: get_ops_geo_by_zipcode
  /api/ops-geo?view=summary   --> Supabase RPC: get_ops_geo_summary
  |
  v
Frontend receives county data array:
  { county_name, retailer_count, revenue, transaction_count, active_deals, ... }
  |
  v
SVG fetched from /public/assets/nc-counties-map.svg and injected into DOM
  |
  v
Build lookup: { "Alamance": {...}, "Wake": {...}, ... }
  |
  v
Loop over .county-path elements:
  - Read data-county attribute
  - Look up in data map
  - Calculate intensity + opacity
  - Set fill color
  - Attach hover/click listeners
  |
  v
Render supporting UI: KPI cards, top counties table, unserved counties, zip table
```

---

## No External Libraries

This is 100% vanilla:
- No D3, Leaflet, Mapbox, or any mapping library
- No GeoJSON/TopoJSON processing
- Just a static SVG with `<path>` elements and JS that sets `style.fill`

The SVG approach gives pixel-perfect control over each county's appearance while keeping the bundle size minimal.

---

## Adapting This for Other Use Cases

The pattern is simple and portable:

1. **Get or create an SVG** with one `<path>` per region, each with a `data-*` attribute for identification
2. **Fetch it at runtime** and inject into the DOM so you can manipulate paths with JS
3. **Map your data** to regions using the `data-*` attribute as the key
4. **Calculate relative intensity** (value / max) and apply as RGBA opacity
5. **Add CSS transitions** on fill/stroke/transform for smooth hover effects
6. **Attach event listeners** for tooltips and detail views

For a birding app, you'd swap the metric from "retailers" to "sightings" and the SVG from NC counties to whatever geography makes sense. The coloring logic, animations, and interactivity pattern would all carry over directly.
