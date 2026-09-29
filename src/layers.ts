import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import type { MapTokens } from './tokens.ts';
import type { Category, Status } from './types.ts';

export const PROJECTS = 'projects';
export const POINTS = 'project-points';
export const CLOSURES = 'closures';
export const MARK = 'selected-mark';
export const SURVEY_MARK_ICON = 'survey-mark';

const isPolygon: ExpressionSpecification = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
const isLine: ExpressionSpecification = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];
const status = (s: Status): ExpressionSpecification => ['==', ['get', 'status'], s];
const category = (c: Category): ExpressionSpecification => ['==', ['get', 'category'], c];
const selected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];
const hovered: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];

/** While a legend row is hovered, every other category fades to about a quarter strength. */
const DIM = 0.25;

function dimOpacity(focus: Category | undefined, value: number | ExpressionSpecification): number | ExpressionSpecification {
  return focus ? ['case', category(focus), value, ['*', value, DIM]] : value;
}

/** fill-extrusion-opacity can't vary per feature, so extrusions fade by mixing toward the land color instead. */
function dimColor(t: MapTokens, focus: Category | undefined, color: ExpressionSpecification): ExpressionSpecification {
  if (!focus) return color;
  const faded = Object.fromEntries(Object.entries(t.category).map(([k, v]) => [k, mix(v, t.land, 1 - DIM)])) as MapTokens['category'];
  return ['case', category(focus), color, byCategory(faded)];
}

export function mix(a: string, b: string, amount: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function byCategory(c: MapTokens['category']): ExpressionSpecification {
  return ['match', ['get', 'category'],
    'residential', c.residential, 'commercial', c.commercial, 'civic', c.civic,
    'transport', c.transport, 'trails', c.trails, c.complete];
}

function stateColor(t: MapTokens, base: ExpressionSpecification | string): ExpressionSpecification {
  return ['case', selected, byCategory(t.categorySelected), hovered, byCategory(t.categorySelected), base];
}

/** Metres: the reported height, else floors × 3.6 m. */
const heightExpr: ExpressionSpecification = ['coalesce', ['get', 'height_m'], ['*', ['get', 'floors'], 3.6]];
/** Only buildings with a known height rise; big sites and unknowns stay on the ground rather than inventing a massing. */
const extrudes: ExpressionSpecification = ['all', isPolygon, ['!', ['to-boolean', ['get', 'flat']]], ['any', ['has', 'height_m'], ['has', 'floors']]];

function extrusion(t: MapTokens, id: string, s: Status, opacity: number, focus?: Category): LayerSpecification {
  return {
    id, type: 'fill-extrusion', source: PROJECTS, minzoom: 12,
    filter: ['all', extrudes, status(s)],
    paint: {
      'fill-extrusion-color': dimColor(t, focus, stateColor(t, s === 'complete' ? t.category.complete : byCategory(t.category))),
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.5, heightExpr],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': opacity,
      'fill-extrusion-vertical-gradient': true,
    },
  };
}

function lineWidth(scale: number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 10, 2 * scale, 13, 4 * scale, 16, 12 * scale];
}

/** Today's lane closures: an opt-in overlay drawn under the project lines. */
export function closureLayers(t: MapTokens, focus?: Category): LayerSpecification[] {
  const fade = focus && focus !== 'transport' ? DIM : 1;
  const closed: ExpressionSpecification = ['==', ['get', 'impact'], 'closed'];
  // Kept well under project line widths so closures read as context, not as projects.
  const width = (scale: number): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], 11, 0.6 * scale, 14, 1.2 * scale, 17, 3 * scale];
  return [
    {
      id: 'closure-partial', type: 'line', source: CLOSURES, minzoom: 11,
      filter: ['!', closed],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': t.category.transport, 'line-width': width(1), 'line-dasharray': [0.5, 2], 'line-opacity': ['case', hovered, fade, 0.55 * fade] },
    },
    {
      id: 'closure-closed', type: 'line', source: CLOSURES, minzoom: 11,
      filter: closed,
      paint: { 'line-color': t.category.transport, 'line-width': width(1.6), 'line-opacity': ['case', hovered, fade, 0.8 * fade] },
    },
  ];
}

/** Project layers in draw order, between the basemap's ground and label layers. */
export function projectLayers(t: MapTokens, focus?: Category): LayerSpecification[] {
  const transport = category('transport');
  const trails = category('trails');
  return [
    {
      id: 'proj-footprint', type: 'fill', source: PROJECTS, minzoom: 12,
      filter: ['all', isPolygon, status('planned')],
      paint: { 'fill-pattern': ['concat', 'hatch-', ['get', 'category']], 'fill-opacity': dimOpacity(focus, 0.9) },
    },
    {
      id: 'proj-footprint-outline', type: 'line', source: PROJECTS, minzoom: 12,
      filter: ['all', isPolygon, status('planned')],
      paint: { 'line-color': byCategory(t.category), 'line-width': 1.2, 'line-dasharray': [2, 2], 'line-opacity': dimOpacity(focus, 1) },
    },
    {
      id: 'proj-ground', type: 'fill', source: PROJECTS, minzoom: 12,
      filter: ['all', isPolygon, ['!', extrudes], ['!=', ['get', 'status'], 'planned']],
      paint: {
        'fill-color': stateColor(t, ['case', status('complete'), t.category.complete, byCategory(t.category)]),
        'fill-opacity': dimOpacity(focus, ['case', selected, 0.45, hovered, 0.4, 0.25]),
      },
    },
    {
      id: 'proj-ground-outline', type: 'line', source: PROJECTS, minzoom: 12,
      filter: ['all', isPolygon, ['!', extrudes], ['!=', ['get', 'status'], 'planned']],
      paint: { 'line-color': ['case', status('complete'), t.category.complete, byCategory(t.category)], 'line-width': 1.2, 'line-opacity': dimOpacity(focus, 1) },
    },
    ...closureLayers(t, focus),
    {
      id: 'proj-line-casing', type: 'line', source: PROJECTS,
      filter: isLine,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': t.labelHalo, 'line-width': lineWidth(1.5), 'line-opacity': dimOpacity(focus, 0.8) },
    },
    {
      id: 'proj-line-active', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('active')],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': stateColor(t, byCategory(t.category)), 'line-width': lineWidth(1), 'line-opacity': dimOpacity(focus, 1) },
    },
    {
      // Hazard stripe overlay: dark dashes over the orange base, like a work-zone barricade.
      id: 'proj-line-hazard', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('active'), transport],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': t.hazard, 'line-width': lineWidth(0.55), 'line-dasharray': [0.6, 0.6], 'line-opacity': dimOpacity(focus, 1) },
    },
    {
      id: 'proj-line-planned', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('planned'), ['!', trails]],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': stateColor(t, byCategory(t.category)), 'line-width': lineWidth(0.7), 'line-dasharray': [2, 1.5], 'line-opacity': dimOpacity(focus, 0.8) },
    },
    {
      id: 'proj-line-planned-trail', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('planned'), trails],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': stateColor(t, byCategory(t.category)), 'line-width': lineWidth(0.7), 'line-dasharray': [0.1, 2], 'line-opacity': dimOpacity(focus, 1) },
    },
    {
      id: 'proj-line-complete', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('complete')],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': stateColor(t, ['case', trails, t.category.trails, t.category.complete]),
        'line-width': lineWidth(0.7),
        'line-opacity': dimOpacity(focus, 1),
      },
    },
    extrusion(t, 'proj-extrude-planned', 'planned', 0.4, focus),
    extrusion(t, 'proj-extrude-complete', 'complete', 0.85, focus),
    extrusion(t, 'proj-extrude-active', 'active', 0.95, focus),
    {
      id: 'proj-selected-outline', type: 'line', source: PROJECTS,
      filter: isPolygon,
      paint: { 'line-color': t.ink, 'line-width': 2, 'line-opacity': ['case', selected, 1, 0] },
    },
    {
      // Points stand in for everything when zoomed out, and for point-only projects when zoomed in.
      id: 'proj-point', type: 'circle', source: POINTS,
      filter: ['all', ['!', ['has', 'point_count']], ['any', ['<', ['zoom'], 12], ['==', ['get', 'geom'], 'Point']]],
      paint: {
        'circle-color': stateColor(t, byCategory(t.category)),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.5, 14, 6, 17, 9],
        'circle-stroke-color': t.labelHalo,
        'circle-stroke-width': ['case', ['==', ['get', 'status'], 'active'], 2, 1],
        'circle-opacity': dimOpacity(focus, ['case', ['==', ['get', 'status'], 'planned'], 0.55, 1]),
        'circle-stroke-opacity': dimOpacity(focus, 1),
      },
    },
  ];
}

/**
 * Clusters draw above the basemap labels: symbol layers higher in the stack are
 * placed first, so a place name like "Austin" would otherwise knock out the count.
 */
export function clusterLayers(t: MapTokens): LayerSpecification[] {
  return [
    {
      id: 'proj-cluster', type: 'circle', source: POINTS, maxzoom: 12,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': t.labelHalo,
        'circle-stroke-color': t.ink,
        'circle-stroke-width': 1,
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 10, 50, 18, 500, 28],
        'circle-opacity': 0.92,
      },
    },
    {
      id: 'proj-cluster-count', type: 'symbol', source: POINTS, maxzoom: 12,
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true },
      paint: { 'text-color': t.ink },
    },
  ];
}

/** Crosshair in a circle at the selected project's anchor point, drawn above everything else. */
export function surveyMarkLayer(): LayerSpecification {
  return {
    id: 'selected-mark', type: 'symbol', source: MARK,
    layout: { 'icon-image': SURVEY_MARK_ICON, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
  };
}

export function surveyMarkImage(t: MapTokens, px = 28, ratio = 2): { data: ImageData; pixelRatio: number } {
  const size = px * ratio;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ratio, ratio);
  const c = px / 2;
  const r = px / 2 - 5;
  ctx.lineCap = 'round';
  for (const [color, width] of [[t.labelHalo, 4], [t.accent, 1.75]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    // The crosshair leaves the centre open so the point it marks stays visible.
    for (const [x1, y1, x2, y2] of [[c, 1.5, c, c - 3], [c, c + 3, c, px - 1.5], [1.5, c, c - 3, c], [c + 3, c, px - 1.5, c]]) {
      ctx.moveTo(x1!, y1!);
      ctx.lineTo(x2!, y2!);
    }
    ctx.stroke();
  }
  return { data: ctx.getImageData(0, 0, size, size), pixelRatio: ratio };
}

export function projectLabelLayer(t: MapTokens, focus?: Category): LayerSpecification {
  return {
    id: 'proj-label', type: 'symbol', source: POINTS, minzoom: 14.5,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      'text-max-width': 10,
      'text-optional': true,
      'symbol-sort-key': ['match', ['get', 'status'], 'active', 0, 'planned', 1, 2],
    },
    paint: { 'text-color': t.ink, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.5, 'text-opacity': dimOpacity(focus, 1) },
  };
}

export function hatchImage(color: string, size = 8): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const o of [-size, 0, size]) {
    ctx.moveTo(o, size);
    ctx.lineTo(o + size, 0);
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}
