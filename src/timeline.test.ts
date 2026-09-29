import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statusAt } from './timeline.ts';
import type { ProjectProps } from './types.ts';

const p = (props: Partial<ProjectProps>): ProjectProps => ({ id: 'x', name: 'x', category: 'residential', status: 'active', lon: 0, lat: 0, ...props });
const NOW = 2026.75;

test('a dated project is hidden before it starts, active while building, complete after', () => {
  const tower = p({ status: 'active', start: '2025-01-01', end: '2028' });
  assert.equal(statusAt(tower, 2024, NOW), null);
  assert.equal(statusAt(tower, 2026, NOW)?.status, 'active');
  assert.equal(statusAt(tower, 2029.5, NOW)?.status, 'complete');
});

test('construction progress runs from 0 at the start to 1 at the end', () => {
  const at = statusAt(p({ status: 'active', start: '2025-01-01', end: '2026' }), 2026.5, NOW);
  assert.equal(at?.status, 'active');
  assert.ok(at!.progress > 0.5 && at!.progress < 1);
});

test('planned work shows as planned in the future and not in the past', () => {
  const plan = p({ status: 'planned' });
  assert.equal(statusAt(plan, 2025, NOW), null);
  assert.equal(statusAt(plan, NOW + 0.25, NOW)?.status, 'planned');
  assert.equal(statusAt(plan, NOW + 2, NOW)?.status, 'active');
});

test('a finished project never reads as still under construction today', () => {
  const done = p({ status: 'complete', start: '2024-03-01' });
  assert.equal(statusAt(done, NOW, NOW)?.status, 'complete');
});
