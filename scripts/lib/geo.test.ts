import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Polygon } from 'geojson';
import { applyOverrides } from '../build-data.ts';
import { anchor, pointInPolygon, roundGeometry } from './geo.ts';
import { makeProject } from './project.ts';

const square: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] };
const ell: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4], [0, 0]]] };

test('anchor is the centroid for convex shapes and stays on the shape for concave ones', () => {
  assert.deepEqual(anchor(square), [1, 1]);
  assert.ok(pointInPolygon(anchor(ell), ell));
});

test('anchor of a line is its halfway point', () => {
  assert.deepEqual(anchor({ type: 'LineString', coordinates: [[0, 0], [10, 0]] }), [5, 0]);
});

test('pointInPolygon respects holes', () => {
  const donut: Polygon = { type: 'Polygon', coordinates: [square.coordinates[0]!, [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5], [0.5, 0.5]]] };
  assert.ok(pointInPolygon([0.25, 0.25], donut));
  assert.ok(!pointInPolygon([1, 1], donut));
});

test('roundGeometry drops points that collapse together', () => {
  const g = roundGeometry({ type: 'LineString', coordinates: [[0.000001, 0], [0.000002, 0], [1, 1]] });
  assert.deepEqual(g.coordinates, [[0, 0], [1, 1]]);
});

test('overrides apply in order and keep JSON-encoded fields intact', () => {
  const f = makeProject(square, {
    id: 'txdot-0015-13-428', name: 'I-35: Holly St to US 290W', category: 'transport', status: 'active',
    links: [{ label: 'TxDOT', url: 'https://example.com' }],
  });
  const [out] = applyOverrides([f], [
    { match: { idPrefix: 'txdot-0015-13-' }, set: { description: 'generic' } },
    { match: { id: 'txdot-0015-13-428' }, set: { name: 'Specific', description: 'specific' } },
  ]);
  assert.equal(out!.properties.name, 'Specific');
  assert.equal(out!.properties.description, 'specific');
  assert.deepEqual(JSON.parse(out!.properties.links!), [{ label: 'TxDOT', url: 'https://example.com' }]);
});
