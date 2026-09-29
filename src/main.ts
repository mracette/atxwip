import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { GeoJSONSource, MapGeoJSONFeature, StyleSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import './styles.css';
import { buildBasemap } from './basemap.ts';
import { escapeHtml as esc, fmtWhen } from './format.ts';
import { CLOSURES, hatchImage, MARK, POINTS, PROJECTS, projectLabelLayer, projectLayers, SURVEY_MARK_ICON, surveyMarkImage, surveyMarkLayer } from './layers.ts';
import { CATEGORY_LABEL, renderPanel, STATUS_GLYPH, STATUS_LABEL } from './panel.ts';
import { initSheet, type Detent } from './sheet.ts';
import { TOKENS, type Theme } from './tokens.ts';
import { CATEGORIES, STATUSES, type Category, type ClosureCollection, type ClosureProps, type DataMeta, type ProjectCollection, type ProjectFeature, type ProjectProps, type Status } from './types.ts';

const HOME = { center: [-97.7431, 30.2672] as [number, number], zoom: 14.2, pitch: 55, bearing: -20 };
const HOME_MOBILE = { ...HOME, zoom: 13.2, pitch: 45 };
const isMobile = () => matchMedia('(max-width: 767px)').matches;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const state = {
  theme: (document.documentElement.dataset.theme as Theme) ?? 'light',
  categories: new Set<Category>(CATEGORIES),
  statuses: new Set<Status>(STATUSES),
  selected: null as string | null,
  hovered: null as string | null,
  data: { type: 'FeatureCollection', features: [] } as ProjectCollection,
  homes: null as ProjectCollection | null,
  showHomes: false,
  closures: null as ClosureCollection | null,
  showClosures: false,
  /** The legend row being hovered; other categories fade while it is set. */
  focus: undefined as Category | undefined,
  byId: new Map<string, ProjectFeature>(),
  meta: undefined as DataMeta | undefined,
};

function allFeatures(): ProjectFeature[] {
  return state.showHomes && state.homes ? [...state.data.features, ...state.homes.features] : state.data.features;
}

function visibleFeatures(): ProjectFeature[] {
  return allFeatures().filter((f) => state.categories.has(f.properties.category) && state.statuses.has(f.properties.status));
}

function asPoints(features: ProjectFeature[]): Feature<Point, ProjectProps & { geom: string }>[] {
  return features.map((f) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [f.properties.lon, f.properties.lat] },
    properties: { ...f.properties, geom: f.geometry.type },
  }));
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function visibleClosures(): FeatureCollection {
  return state.showClosures && state.closures && state.categories.has('transport') ? state.closures : EMPTY;
}

function selectedMark(): FeatureCollection {
  const f = state.selected ? state.byId.get(state.selected) : undefined;
  return f
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [f.properties.lon, f.properties.lat] }, properties: {} }] }
    : EMPTY;
}

function buildStyle(theme: Theme): StyleSpecification {
  const t = TOKENS[theme];
  const visible = visibleFeatures();
  return buildBasemap(t, [...projectLayers(t, state.focus), projectLabelLayer(t, state.focus)], {
    [CLOSURES]: { type: 'geojson', data: visibleClosures(), generateId: true },
    [MARK]: { type: 'geojson', data: selectedMark() },
    [PROJECTS]: { type: 'geojson', data: { type: 'FeatureCollection', features: visible }, promoteId: 'id' },
    [POINTS]: {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: asPoints(visible) },
      promoteId: 'id',
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 44,
    },
  }, [surveyMarkLayer()]);
}

const params = new URLSearchParams(location.search);
const view = params.get('view')?.split(',').map(Number);
const start = view?.length === 5 && view.every(Number.isFinite)
  ? { center: [view[1]!, view[0]!] as [number, number], zoom: view[2]!, pitch: view[3]!, bearing: view[4]! }
  : isMobile() ? HOME_MOBILE : HOME;

// MapLibre locates its worker relative to its own module, which production bundling breaks.
if (import.meta.env.PROD) maplibregl.setWorkerUrl(workerUrl);

const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(state.theme),
  ...start,
  maxPitch: 70,
  minZoom: 8.5,
  maxBounds: [[-98.6, 29.7], [-96.9, 30.95]],
  attributionControl: false,
  hash: false,
});
if (import.meta.env.DEV) Object.assign(window, { map });
const mapLoaded = new Promise<void>((resolve) => map.once('load', () => resolve()));
map.addControl(new maplibregl.AttributionControl({
  compact: true,
  customAttribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
}), 'bottom-right');
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

map.setMissingStyleImageResolver((id) => {
  if (id === SURVEY_MARK_ICON) {
    const { data, pixelRatio } = surveyMarkImage(TOKENS[state.theme]);
    map.addImage(id, data, { pixelRatio });
    return;
  }
  const cat = id.startsWith('hatch-') ? (id.slice(6) as Category) : null;
  if (!cat || !(cat in TOKENS[state.theme].category) || map.hasImage(id)) return;
  map.addImage(id, hatchImage(TOKENS[state.theme].category[cat]));
});

function refreshSources() {
  const visible = visibleFeatures();
  (map.getSource(PROJECTS) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: visible });
  (map.getSource(POINTS) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: asPoints(visible) });
  (map.getSource(CLOSURES) as GeoJSONSource | undefined)?.setData(visibleClosures());
  renderCounter(visible);
  renderLegend();
}

function setFeatureState(id: string | null, key: 'selected' | 'hover', value: boolean) {
  if (!id || !map.getSource(PROJECTS)) return;
  map.setFeatureState({ source: PROJECTS, id }, { [key]: value });
  map.setFeatureState({ source: POINTS, id }, { [key]: value });
}

/* ---------- Legend ---------- */

function counts(): Record<Category, number> {
  const c = Object.fromEntries(CATEGORIES.map((k) => [k, 0])) as Record<Category, number>;
  for (const f of allFeatures()) if (state.statuses.has(f.properties.status)) c[f.properties.category]++;
  return c;
}

const CATEGORY_SUB: Record<Category, string> = {
  residential: 'Apartments, condos, townhomes',
  commercial: 'Towers, offices, retail, hotels',
  civic: 'Convention center, airport, schools',
  transport: 'I-35, rail, bridges, streets',
  trails: 'Urban trails, greenways, parks',
};

function renderLegend() {
  const c = counts();
  $('category-rows').innerHTML = CATEGORIES.map((cat) => {
    const line = cat === 'transport' || cat === 'trails';
    return `<button type="button" class="cat-row" role="switch" data-cat="${cat}" aria-checked="${state.categories.has(cat)}">
      <span class="swatch${line ? ' line' : ''}" style="background:var(--cat-${cat})"></span>
      <span class="label">${CATEGORY_LABEL[cat]}<span class="sub">${CATEGORY_SUB[cat]}</span></span>
      <span class="count">${c[cat]}</span>
    </button>${cat === 'residential' ? `
    <label class="sub-toggle"><input type="checkbox" id="homes-toggle" ${state.showHomes ? 'checked' : ''} ${state.categories.has('residential') ? '' : 'disabled'} />
      Include houses &amp; duplexes${state.homes ? ` <span class="count">${state.homes.features.filter((f) => state.statuses.has(f.properties.status)).length.toLocaleString()}</span>` : ''}</label>` : ''}${cat === 'transport' ? `
    <label class="sub-toggle closures"><input type="checkbox" id="closures-toggle" ${state.showClosures ? 'checked' : ''} ${state.categories.has('transport') ? '' : 'disabled'} />
      Show today's lane closures${state.closures ? ` <span class="count">${state.closures.features.length.toLocaleString()}</span>` : ''}</label>` : ''}`;
  }).join('');
  $('status-seg').innerHTML = STATUSES.map((s) => `
    <button type="button" data-status="${s}" aria-pressed="${state.statuses.has(s)}">
      <span class="glyph" aria-hidden="true">${STATUS_GLYPH[s]}</span>${s === 'active' ? 'Building' : STATUS_LABEL[s]}
    </button>`).join('');
}

$('category-rows').addEventListener('click', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-cat]');
  if (!row) return;
  const cat = row.dataset.cat as Category;
  if (state.categories.has(cat)) state.categories.delete(cat);
  else state.categories.add(cat);
  setFocus(undefined);
  refreshSources();
  writeUrl();
});
$('category-rows').addEventListener('change', async (e) => {
  const box = e.target as HTMLInputElement;
  if (box.id === 'homes-toggle') {
    box.disabled = true;
    state.showHomes = box.checked && (await loadHomes());
  } else if (box.id === 'closures-toggle') {
    box.disabled = true;
    state.showClosures = box.checked && (await loadClosures());
  } else return;
  refreshSources();
  writeUrl();
});

async function loadClosures(): Promise<boolean> {
  if (state.closures) return true;
  try {
    state.closures = await fetch(`${import.meta.env.BASE_URL}data/closures.json`).then((r) => r.json() as Promise<ClosureCollection>);
    return true;
  } catch {
    return false;
  }
}

function setFocus(cat: Category | undefined) {
  const next = cat && state.categories.has(cat) ? cat : undefined;
  if (next === state.focus) return;
  state.focus = next;
  const t = TOKENS[state.theme];
  for (const layer of [...projectLayers(t, next), projectLabelLayer(t, next)]) {
    if (!map.getLayer(layer.id) || !('paint' in layer) || !layer.paint) continue;
    for (const [k, v] of Object.entries(layer.paint)) map.setPaintProperty(layer.id, k as Parameters<typeof map.setPaintProperty>[1], v);
  }
}

$('category-rows').addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  setFocus((e.target as HTMLElement).closest<HTMLElement>('.cat-row')?.dataset.cat as Category | undefined);
});
$('category-rows').addEventListener('pointerleave', () => setFocus(undefined));
$('category-rows').addEventListener('focusin', (e) => setFocus((e.target as HTMLElement).closest<HTMLElement>('.cat-row')?.dataset.cat as Category | undefined));
$('category-rows').addEventListener('focusout', () => setFocus(undefined));

async function loadHomes(): Promise<boolean> {
  if (state.homes) return true;
  try {
    const homes = await fetch(`${import.meta.env.BASE_URL}data/homes.json`).then((r) => r.json() as Promise<ProjectCollection>);
    for (const f of homes.features) state.byId.set(f.properties.id, f);
    state.homes = homes;
    return true;
  } catch {
    return false;
  }
}
$('status-seg').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-status]');
  if (!btn) return;
  const s = btn.dataset.status as Status;
  if (state.statuses.has(s)) state.statuses.delete(s);
  else state.statuses.add(s);
  refreshSources();
  writeUrl();
});
$('legend-toggle').addEventListener('click', () => {
  const btn = $('legend-toggle');
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $('legend-body').hidden = !open;
});
if (isMobile()) $('legend-toggle').click();

function renderCounter(visible: ProjectFeature[]) {
  const active = visible.filter((f) => f.properties.status === 'active').length;
  $('counter').textContent = `${visible.length.toLocaleString()} projects · ${active.toLocaleString()} under construction`;
}

/* ---------- Camera controls ---------- */

$('pitch-btn').addEventListener('click', () => {
  const flat = map.getPitch() < 5;
  map.easeTo({ pitch: flat ? 55 : 0, duration: reducedMotion() ? 0 : 600 });
});
map.on('pitchend', () => ($('pitch-btn').textContent = map.getPitch() < 5 ? '3D' : '2D'));
$('reset-btn').addEventListener('click', () => {
  const home = isMobile() ? HOME_MOBILE : HOME;
  map.flyTo({ ...home, duration: reducedMotion() ? 0 : 1200 });
});

/* ---------- Theme ---------- */

$('theme-btn').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  try {
    localStorage.setItem('theme', state.theme);
  } catch { /* storage can be blocked; the toggle still works for this visit */ }
  if (map.hasImage(SURVEY_MARK_ICON)) map.removeImage(SURVEY_MARK_ICON);
  map.setStyle(buildStyle(state.theme), { diff: false });
  map.once('idle', () => setFeatureState(state.selected, 'selected', true));
});

/* ---------- Hover + tooltip ---------- */

const CLOSURE_LAYERS = ['closure-closed', 'closure-partial'];
let hoveredClosure: string | number | undefined;
const INTERACTIVE = ['proj-extrude-active', 'proj-extrude-planned', 'proj-extrude-complete', 'proj-footprint', 'proj-ground',
  'proj-line-active', 'proj-line-planned', 'proj-line-planned-trail', 'proj-line-complete', 'proj-point'];
const tooltip = $('tooltip');

function pick(point: maplibregl.PointLike): MapGeoJSONFeature | undefined {
  const layers = INTERACTIVE.filter((l) => map.getLayer(l));
  const [x, y] = Array.isArray(point) ? point : [(point as maplibregl.Point).x, (point as maplibregl.Point).y];
  const pad = 4;
  return map.queryRenderedFeatures([[x - pad, y - pad], [x + pad, y + pad]], { layers })[0];
}

map.on('mousemove', (e) => {
  const f = pick(e.point);
  const id = (f?.properties.id as string | undefined) ?? null;
  if (id !== state.hovered) {
    setFeatureState(state.hovered, 'hover', false);
    setFeatureState(id, 'hover', true);
    state.hovered = id;
  }
  map.getCanvas().style.cursor = f ? 'pointer' : '';
  const cluster = map.queryRenderedFeatures(e.point, { layers: ['proj-cluster'] })[0];
  if (cluster) map.getCanvas().style.cursor = 'zoom-in';
  const closure = f ? undefined : pickClosure(e.point);
  if (closure?.id !== hoveredClosure) {
    if (hoveredClosure !== undefined) map.setFeatureState({ source: CLOSURES, id: hoveredClosure }, { hover: false });
    if (closure?.id !== undefined) map.setFeatureState({ source: CLOSURES, id: closure.id }, { hover: true });
    hoveredClosure = closure?.id;
  }
  if ((!f && !closure) || isMobile()) {
    tooltip.hidden = true;
    return;
  }
  if (f) {
    const p = f.properties as ProjectProps;
    tooltip.innerHTML = `${esc(p.name)}<span class="sub">${STATUS_GLYPH[p.status]} ${STATUS_LABEL[p.status]} · ${CATEGORY_LABEL[p.category]}</span>`;
  } else {
    const c = closure!.properties as ClosureProps;
    const what = c.impact === 'closed' ? 'Road closed' : 'Lanes closed';
    tooltip.innerHTML = `${esc(c.road)}${c.work ? `<span class="sub-line">${esc(c.work)}</span>` : ''}<span class="sub">${what}${c.end ? ` until ${esc(fmtWhen(c.end))}` : ''} · ${c.by === 'txdot' ? 'TxDOT' : 'City permit'}</span>`;
  }
  tooltip.style.left = `${e.originalEvent.clientX + 14}px`;
  tooltip.style.top = `${e.originalEvent.clientY + 14}px`;
  tooltip.hidden = false;
});
function pickClosure(point: maplibregl.Point): MapGeoJSONFeature | undefined {
  const layers = CLOSURE_LAYERS.filter((l) => map.getLayer(l));
  if (!layers.length || !state.showClosures) return undefined;
  const pad = 4;
  return map.queryRenderedFeatures([[point.x - pad, point.y - pad], [point.x + pad, point.y + pad]], { layers })[0];
}

map.getCanvas().addEventListener('mouseleave', () => {
  tooltip.hidden = true;
  if (hoveredClosure !== undefined) map.setFeatureState({ source: CLOSURES, id: hoveredClosure }, { hover: false });
  hoveredClosure = undefined;
  setFeatureState(state.hovered, 'hover', false);
  state.hovered = null;
});

/* ---------- Selection + panel ---------- */

const panel = $('panel');
const sheet = initSheet(panel, $('grabber'));

function corridorOf(f: ProjectFeature): ProjectFeature[] {
  const c = f.properties.corridor;
  return c ? state.data.features.filter((m) => m.properties.corridor === c) : [];
}

function select(id: string | null, opts: { fly?: boolean; detent?: Detent } = {}) {
  setFeatureState(state.selected, 'selected', false);
  setSegmentHover(null);
  state.selected = id;
  (map.getSource(MARK) as GeoJSONSource | undefined)?.setData(selectedMark());
  const f = id ? state.byId.get(id) : undefined;
  if (!f) {
    panel.hidden = true;
    map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: reducedMotion() ? 0 : 300 });
    writeUrl();
    return;
  }
  setFeatureState(id, 'selected', true);
  $('panel-content').innerHTML = renderPanel(f, state.meta?.generatedAt, corridorOf(f));
  $('panel-content').scrollTop = 0;
  panel.hidden = false;
  if (isMobile()) sheet.set(opts.detent ?? 'peek');
  if (opts.fly !== false) flyToFeature(f);
  writeUrl();
}

function flyToFeature(f: ProjectFeature) {
  const mobile = isMobile();
  const padding = mobile
    ? { top: 70, bottom: 200, left: 20, right: 20 }
    : { top: 80, bottom: 60, left: 80, right: 420 };
  const [minX, minY, maxX, maxY] = bbox(f);
  // Pull back for tall towers so the whole extrusion stays in frame, not just its base.
  const height = f.properties.height_m ?? (f.properties.floors ?? 0) * 3.6;
  const maxZoom = height > 150 ? 14.6 : height > 60 ? 15.3 : 16;
  const cam = map.cameraForBounds([[minX, minY], [maxX, maxY]], { padding, maxZoom });
  const isBig = maxX - minX > 0.02 || maxY - minY > 0.02;
  map.flyTo({
    center: cam?.center ?? [f.properties.lon, f.properties.lat],
    zoom: Math.max(cam?.zoom ?? 16, isBig ? 11 : 15),
    pitch: isBig ? 30 : 55,
    bearing: map.getBearing(),
    padding,
    duration: reducedMotion() ? 0 : 900,
    curve: 1.2,
    essential: false,
  });
}

function bbox(f: ProjectFeature): [number, number, number, number] {
  let b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as [number, number];
      b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  if ('coordinates' in f.geometry) visit(f.geometry.coordinates);
  return b;
}

map.on('click', (e) => {
  const cluster = map.queryRenderedFeatures(e.point, { layers: ['proj-cluster'] })[0];
  if (cluster) {
    map.easeTo({ center: (cluster.geometry as Point).coordinates as [number, number], zoom: map.getZoom() + 2 });
    return;
  }
  const f = pick(e.point);
  select((f?.properties.id as string | undefined) ?? null);
});

/* Hovering a corridor timeline row highlights that segment on the map; choosing it opens it. */
let segmentHover: string | null = null;
function setSegmentHover(id: string | null) {
  if (id === segmentHover) return;
  if (segmentHover !== state.hovered) setFeatureState(segmentHover, 'hover', false);
  setFeatureState(id, 'hover', true);
  panel.querySelectorAll<SVGGElement>('.tl-row').forEach((g) => g.classList.toggle('active', g.dataset.segment === id));
  segmentHover = id;
}

function segmentAt(target: EventTarget | null): string | null {
  return (target as Element | null)?.closest<SVGGElement>('[data-segment]')?.dataset.segment ?? null;
}

panel.addEventListener('pointerover', (e) => setSegmentHover(segmentAt(e.target)));
panel.addEventListener('pointerleave', () => setSegmentHover(null));
panel.addEventListener('focusin', (e) => setSegmentHover(segmentAt(e.target)));
panel.addEventListener('focusout', () => setSegmentHover(null));
panel.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-close]')) select(null);
  const seg = segmentAt(e.target);
  if (seg) chooseProject(seg);
});
panel.addEventListener('keydown', (e) => {
  const seg = segmentAt(e.target);
  if (seg && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    chooseProject(seg);
  }
});

/** Selects a project, turning its layer and status back on if the viewer had hidden them. */
function chooseProject(id: string) {
  const f = state.byId.get(id);
  if (!f) return;
  state.categories.add(f.properties.category);
  state.statuses.add(f.properties.status);
  refreshSources();
  select(id);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$<HTMLDialogElement>('about').open) select(null);
});

/* ---------- Search ---------- */

const searchInput = $<HTMLInputElement>('search');
const results = $<HTMLUListElement>('search-results');
let resultIds: string[] = [];
let activeResult = -1;

function renderResults() {
  const q = searchInput.value.trim().toLowerCase();
  if (q.length < 2) {
    results.hidden = true;
    resultIds = [];
    return;
  }
  const terms = q.split(/\s+/);
  const hits = allFeatures()
    .filter((f) => {
      const hay = `${f.properties.name} ${f.properties.address ?? ''} ${f.properties.neighborhood ?? ''} ${f.properties.developer ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => Number(b.properties.name.toLowerCase().startsWith(q)) - Number(a.properties.name.toLowerCase().startsWith(q)))
    .slice(0, 12);
  resultIds = hits.map((f) => f.properties.id);
  activeResult = -1;
  results.innerHTML = hits.length
    ? hits.map((f, i) => `<li role="option" data-i="${i}"><span class="dot swatch" style="width:8px;height:8px;border-radius:50%;background:var(--cat-${f.properties.category})"></span>${esc(f.properties.name)}<span class="sub">${STATUS_LABEL[f.properties.status]}</span></li>`).join('')
    : '<li aria-disabled="true">No matching projects</li>';
  results.hidden = false;
}

function chooseResult(i: number) {
  const id = resultIds[i];
  if (!id) return;
  results.hidden = true;
  searchInput.blur();
  chooseProject(id);
}

searchInput.addEventListener('input', renderResults);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = resultIds.length;
    if (!n) return;
    activeResult = (activeResult + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    results.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === activeResult)));
  } else if (e.key === 'Enter') {
    chooseResult(Math.max(activeResult, 0));
  } else if (e.key === 'Escape') {
    results.hidden = true;
  }
});
results.addEventListener('mousedown', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (li) chooseResult(Number(li.dataset.i));
});
searchInput.addEventListener('blur', () => setTimeout(() => (results.hidden = true), 100));

/* ---------- About ---------- */

$('about-btn').addEventListener('click', () => {
  const sources = state.meta?.sources ?? [];
  $('about-content').innerHTML = `
    <div class="panel-top"><span class="eyebrow">About</span><button class="close-btn" type="button" data-close-about aria-label="Close">×</button></div>
    <h2>What's being built in Austin</h2>
    <p>Every colored shape is a project that is planned, under construction, or recently finished. Buildings rise to their permitted height; roads and trails under construction are striped. Click anything for details.</p>
    <h3>Where the data comes from</h3>
    <ul>${sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>: <span class="mono">${s.count.toLocaleString()}</span> projects</li>`).join('')}
      ${(state.meta?.closureSources ?? []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>: <span class="mono">${s.count.toLocaleString()}</span> lane closures</li>`).join('')}</ul>
    <p class="caption">Data refreshed <span class="mono">${esc(state.meta?.generatedAt.slice(0, 10) ?? 'unknown')}</span>. Permits and project schedules change; check the linked source before relying on a date or dollar figure.</p>
    <h3>Reading the map</h3>
    <ul>
      <li><strong>Solid</strong> buildings are under construction. <strong>Ghosted, hatched</strong> ones are planned. <strong>Gray</strong> ones recently finished.</li>
      <li>Heights come from permitted floor counts (about 3.6 m per floor), so they are approximate.</li>
      <li>Zoomed out, projects gather into numbered circles. Click one to zoom in.</li>
      <li>Turn on <strong>today's lane closures</strong> under Transportation to see streets with work crews in them. Thin solid orange lines are fully closed; dotted lines have some lanes open.</li>
    </ul>
    <p class="caption">Source code on <a href="https://github.com/mracette/austin-wip" target="_blank" rel="noopener">GitHub</a>.</p>`;
  $<HTMLDialogElement>('about').showModal();
});
$('about').addEventListener('click', (e) => {
  const dlg = $<HTMLDialogElement>('about');
  if (e.target === dlg || (e.target as HTMLElement).closest('[data-close-about]')) dlg.close();
});

/* ---------- URL state ---------- */

let urlTimer: number | undefined;
function writeUrl() {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    const c = map.getCenter();
    const q = new URLSearchParams();
    if (state.selected) q.set('p', state.selected);
    if (state.categories.size < CATEGORIES.length) q.set('layers', [...state.categories].join(','));
    if (state.statuses.size < STATUSES.length) q.set('status', [...state.statuses].join(','));
    if (state.showHomes) q.set('homes', '1');
    if (state.showClosures) q.set('closures', '1');
    q.set('view', [c.lat.toFixed(5), c.lng.toFixed(5), map.getZoom().toFixed(2), map.getPitch().toFixed(0), map.getBearing().toFixed(0)].join(','));
    history.replaceState(null, '', `${location.pathname}?${q.toString().replace(/%2C/g, ',')}`);
  }, 250);
}
map.on('moveend', writeUrl);

function readUrlFilters() {
  const layers = params.get('layers')?.split(',').filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
  if (layers) state.categories = new Set(layers);
  const statuses = params.get('status')?.split(',').filter((s): s is Status => (STATUSES as readonly string[]).includes(s));
  if (statuses) state.statuses = new Set(statuses);
}

/* ---------- Boot ---------- */

async function load() {
  readUrlFilters();
  renderLegend();
  const base = import.meta.env.BASE_URL;
  const [data, meta] = await Promise.all([
    fetch(`${base}data/projects.json`).then((r) => r.json() as Promise<ProjectCollection>),
    fetch(`${base}data/meta.json`).then((r) => (r.ok ? (r.json() as Promise<DataMeta>) : undefined)).catch(() => undefined),
  ]);
  state.data = data;
  state.meta = meta;
  state.byId = new Map(data.features.map((f) => [f.properties.id, f]));
  if (params.get('homes') === '1') state.showHomes = await loadHomes();
  if (params.get('closures') === '1') state.showClosures = await loadClosures();
  await mapLoaded;
  refreshSources();
  const p = params.get('p');
  if (p && state.byId.has(p)) select(p, { fly: !view });
}

load().catch((err) => {
  console.error(err);
  $('counter').textContent = 'Could not load project data';
});
