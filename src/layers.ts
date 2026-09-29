import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import type { MapTokens } from './tokens.ts';
import type { Category, Status } from './types.ts';

export const PROJECTS = 'projects';
export const POINTS = 'project-points';

const isPolygon: ExpressionSpecification = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
const isLine: ExpressionSpecification = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];
const status = (s: Status): ExpressionSpecification => ['==', ['get', 'status'], s];
const category = (c: Category): ExpressionSpecification => ['==', ['get', 'category'], c];
const selected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];
const hovered: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];

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

function extrusion(t: MapTokens, id: string, s: Status, opacity: number): LayerSpecification {
  return {
    id, type: 'fill-extrusion', source: PROJECTS, minzoom: 12,
    filter: ['all', extrudes, status(s)],
    paint: {
      'fill-extrusion-color': stateColor(t, s === 'complete' ? t.category.complete : byCategory(t.category)),
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

/** Project layers in draw order, between the basemap's ground and label layers. */
export function projectLayers(t: MapTokens): LayerSpecification[] {
  const transport = category('transport');
  const trails = category('trails');
  return [
    {
      id: 'proj-footprint', type: 'fill', source: PROJECTS, minzoom: 12,
      filter: ['all', isPolygon, status('planned')],
      paint: { 'fill-pattern': ['concat', 'hatch-', ['get', 'category']], 'fill-opacity': 0.9 },
    },
    {
      id: 'proj-footprint-outline', type: 'line', source: PROJECTS, minzoom: 12,
      filter: ['all', isPolygon, status('planned')],
      paint: { 'line-color': byCategory(t.category), 'line-width': 1.2, 'line-dasharray': [2, 2] },
    },
    {
      id: 'proj-ground', type: 'fill', source: PROJECTS, minzoom: 12,
      filter: ['all', isPolygon, ['!', extrudes], ['!=', ['get', 'status'], 'planned']],
      paint: {
        'fill-color': stateColor(t, ['case', status('complete'), t.category.complete, byCategory(t.category)]),
        'fill-opacity': ['case', selected, 0.45, hovered, 0.4, 0.25],
      },
    },
    {
      id: 'proj-ground-outline', type: 'line', source: PROJECTS, minzoom: 12,
      filter: ['all', isPolygon, ['!', extrudes], ['!=', ['get', 'status'], 'planned']],
      paint: { 'line-color': ['case', status('complete'), t.category.complete, byCategory(t.category)], 'line-width': 1.2 },
    },
    {
      id: 'proj-line-casing', type: 'line', source: PROJECTS,
      filter: isLine,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': t.labelHalo, 'line-width': lineWidth(1.5), 'line-opacity': 0.8 },
    },
    {
      id: 'proj-line-active', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('active')],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': stateColor(t, byCategory(t.category)), 'line-width': lineWidth(1) },
    },
    {
      // Hazard stripe overlay: dark dashes over the orange base, like a work-zone barricade.
      id: 'proj-line-hazard', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('active'), transport],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': t.hazard, 'line-width': lineWidth(0.55), 'line-dasharray': [0.6, 0.6] },
    },
    {
      id: 'proj-line-planned', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('planned'), ['!', trails]],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': stateColor(t, byCategory(t.category)), 'line-width': lineWidth(0.7), 'line-dasharray': [2, 1.5], 'line-opacity': 0.8 },
    },
    {
      id: 'proj-line-planned-trail', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('planned'), trails],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': stateColor(t, byCategory(t.category)), 'line-width': lineWidth(0.7), 'line-dasharray': [0.1, 2] },
    },
    {
      id: 'proj-line-complete', type: 'line', source: PROJECTS,
      filter: ['all', isLine, status('complete')],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': stateColor(t, ['case', trails, t.category.trails, t.category.complete]),
        'line-width': lineWidth(0.7),
      },
    },
    extrusion(t, 'proj-extrude-planned', 'planned', 0.4),
    extrusion(t, 'proj-extrude-complete', 'complete', 0.85),
    extrusion(t, 'proj-extrude-active', 'active', 0.95),
    {
      id: 'proj-selected-outline', type: 'line', source: PROJECTS,
      filter: isPolygon,
      paint: { 'line-color': t.ink, 'line-width': 2, 'line-opacity': ['case', selected, 1, 0] },
    },
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
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 11 },
      paint: { 'text-color': t.ink },
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
        'circle-opacity': ['case', ['==', ['get', 'status'], 'planned'], 0.55, 1],
      },
    },
  ];
}

export function projectLabelLayer(t: MapTokens): LayerSpecification {
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
    paint: { 'text-color': t.ink, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.5 },
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
