import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { MapTokens } from './tokens.ts';

const SRC = 'openmaptiles';
const FONT_REGULAR = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_ITALIC = ['Noto Sans Italic'];

const polygonsOnly: ExpressionSpecification = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];

function roadWidth(base: number, max: number): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.5], ['zoom'], 8, base * 0.3, 12, base, 17, max];
}

/** Layers drawn before project data. */
function groundLayers(t: MapTokens): LayerSpecification[] {
  const road = (id: string, classes: string[], color: string, casing: string | null, base: number, max: number, minzoom = 5): LayerSpecification[] => {
    const filter: ExpressionSpecification = ['all', ['match', ['get', 'class'], classes, true, false], ['!=', ['get', 'brunnel'], 'tunnel']];
    const layers: LayerSpecification[] = [];
    if (casing) {
      layers.push({
        id: `${id}-casing`, type: 'line', source: SRC, 'source-layer': 'transportation', minzoom, filter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': casing, 'line-width': roadWidth(base + 1, max + 2) },
      });
    }
    layers.push({
      id, type: 'line', source: SRC, 'source-layer': 'transportation', minzoom, filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': roadWidth(base, max) },
    });
    return layers;
  };

  return [
    { id: 'background', type: 'background', paint: { 'background-color': t.land } },
    {
      id: 'park', type: 'fill', source: SRC, 'source-layer': 'park', filter: polygonsOnly,
      paint: { 'fill-color': t.park },
    },
    {
      id: 'landcover-wood', type: 'fill', source: SRC, 'source-layer': 'landcover',
      filter: ['all', polygonsOnly, ['match', ['get', 'class'], ['wood', 'grass'], true, false]],
      paint: { 'fill-color': t.park, 'fill-opacity': 0.5 },
    },
    {
      id: 'water', type: 'fill', source: SRC, 'source-layer': 'water',
      filter: ['all', polygonsOnly, ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'fill-color': t.water },
    },
    {
      id: 'waterway', type: 'line', source: SRC, 'source-layer': 'waterway', minzoom: 11,
      paint: { 'line-color': t.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 2.5] },
    },
    {
      id: 'building', type: 'fill', source: SRC, 'source-layer': 'building', minzoom: 14,
      paint: { 'fill-color': t.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] },
    },
    ...road('road-minor', ['minor', 'service'], t.roadMinor, null, 0.6, 9, 12),
    ...road('road-major', ['primary', 'secondary', 'tertiary', 'trunk'], t.roadMajor, t.roadCasing, 1, 16, 8),
    ...road('road-highway', ['motorway'], t.highway, t.highwayCasing, 1.4, 20, 5),
    {
      id: 'rail', type: 'line', source: SRC, 'source-layer': 'transportation', minzoom: 11,
      filter: ['match', ['get', 'class'], ['rail', 'transit'], true, false],
      paint: { 'line-color': t.rail, 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    {
      id: 'boundary', type: 'line', source: SRC, 'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 4],
      paint: { 'line-color': t.boundary, 'line-width': 0.75, 'line-dasharray': [4, 2] },
    },
  ];
}

/**
 * OSM buildings that a tracked project draws itself. Without this the two
 * extrusions z-fight; 11958095702 is also a block-sized outline tagged with
 * the tower's full height.
 */
const REPLACED_OSM_BUILDINGS = [12139667662, 11958095702];

/** Context buildings as low 3D massing so project extrusions sit in a real skyline. */
function contextBuildings(t: MapTokens): LayerSpecification {
  return {
    id: 'building-3d', type: 'fill-extrusion', source: SRC, 'source-layer': 'building', minzoom: 14,
    filter: ['!', ['in', ['id'], ['literal', REPLACED_OSM_BUILDINGS]]],
    paint: {
      'fill-extrusion-color': t.building,
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['coalesce', ['get', 'render_height'], 0]],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.7,
    },
  };
}

/** Layers drawn above project data. */
function labelLayers(t: MapTokens): LayerSpecification[] {
  const halo = { 'text-halo-color': t.labelHalo, 'text-halo-width': 1.5, 'text-halo-blur': 0.5 };
  return [
    {
      id: 'water-label', type: 'symbol', source: SRC, 'source-layer': 'water_name',
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT_ITALIC, 'text-size': 12, 'symbol-placement': 'point' },
      paint: { 'text-color': t.labelWater, ...halo },
    },
    {
      id: 'waterway-label', type: 'symbol', source: SRC, 'source-layer': 'waterway', minzoom: 13,
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT_ITALIC, 'text-size': 11, 'symbol-placement': 'line' },
      paint: { 'text-color': t.labelWater, ...halo },
    },
    {
      id: 'road-label', type: 'symbol', source: SRC, 'source-layer': 'transportation_name', minzoom: 13,
      filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'], true, false],
      layout: {
        'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'symbol-placement': 'line',
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 13],
      },
      paint: { 'text-color': t.label, ...halo },
    },
    {
      id: 'neighborhood-label', type: 'symbol', source: SRC, 'source-layer': 'place', minzoom: 11, maxzoom: 15.5,
      filter: ['match', ['get', 'class'], ['suburb', 'neighbourhood', 'quarter'], true, false],
      layout: {
        'text-field': ['upcase', ['get', 'name']], 'text-font': FONT_REGULAR, 'text-size': 10.5,
        'text-letter-spacing': 0.12, 'text-max-width': 8,
      },
      paint: { 'text-color': t.labelMinor, ...halo },
    },
    {
      id: 'place-label', type: 'symbol', source: SRC, 'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false],
      layout: {
        'text-field': ['get', 'name'], 'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 12, 15],
      },
      paint: { 'text-color': t.label, ...halo },
    },
  ];
}

export function buildBasemap(t: MapTokens, projectLayers: LayerSpecification[], sources: StyleSpecification['sources']): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      [SRC]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      ...sources,
    },
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.35, position: [1.2, 210, 40] },
    layers: [...groundLayers(t), contextBuildings(t), ...projectLayers, ...labelLayers(t)],
  };
}
