import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProjectFeature, ProjectProps } from '../../src/types.ts';
import { tagChanges } from './history.ts';

const project = (props: Partial<ProjectProps> & { id: string }): ProjectFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [0, 0] },
  properties: { name: props.id, category: 'residential', status: 'planned', lon: 0, lat: 0, ...props },
});
const now = new Date('2026-10-10T12:00:00Z');

test('permit dates mark ground-breaking and completion from the very first build', () => {
  const fs = [
    project({ id: 'a', status: 'active', start: '2026-10-07' }),
    project({ id: 'b', status: 'complete', start: '2024-01-01', end: '2026-10-09' }),
    project({ id: 'c', status: 'active', start: '2026-09-01' }),
    project({ id: 'd', status: 'planned', filed: '2026-10-06' }),
  ];
  tagChanges(fs, undefined, now);
  assert.deepEqual(fs.map((f) => f.properties.change), ['started', 'finished', undefined, 'new']);
});

test('projects that appear after the first build are new, but not the ones seen at baseline', () => {
  const history = tagChanges([project({ id: 'old' })], undefined, new Date('2026-10-01T12:00:00Z'));
  const fs = [project({ id: 'old' }), project({ id: 'fresh' })];
  tagChanges(fs, history, now);
  assert.deepEqual(fs.map((f) => f.properties.change), [undefined, 'new']);
});

test('a flood of arrivals is treated as a data change, not a busy week', () => {
  const history = tagChanges([project({ id: 'old' })], undefined, new Date('2026-10-01T12:00:00Z'));
  const fs = Array.from({ length: 200 }, (_, i) => project({ id: `p${i}` }));
  tagChanges(fs, history, now);
  assert.ok(fs.every((f) => !f.properties.change));
});
