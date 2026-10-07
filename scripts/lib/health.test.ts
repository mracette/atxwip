import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessHealth, healthReport, STALE_DAYS, type SourceRun } from './health.ts';

const now = new Date('2026-10-10T12:00:00Z');
const run = (id: string, ok: boolean, extra: Partial<SourceRun> = {}): SourceRun => ({ id, name: id, ok, fetchedAt: '2026-10-09T12:00:00Z', count: 10, ...extra });

test('a source keeps the date it started failing until it recovers', () => {
  const first = assessHealth([run('trails', false), run('txdot', true)], {}, now);
  assert.deepEqual(first.failingSince, { trails: now.toISOString() });
  const later = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
  assert.equal(assessHealth([run('trails', false)], first.failingSince, later).problems[0]!.days, 3);
  assert.deepEqual(assessHealth([run('trails', true)], first.failingSince, later).failingSince, {});
});

test(`a source failing for ${STALE_DAYS} days is stale`, () => {
  const since = new Date(now.getTime() - STALE_DAYS * 24 * 3600 * 1000).toISOString();
  const health = assessHealth([run('trails', false), run('txdot', false)], { trails: since }, now);
  assert.deepEqual(health.stale, ['trails']);
});

test('the report mentions the owner and lists failing sources in a stable marker', () => {
  const health = assessHealth([run('txdot', false, { error: 'HTTP 500' }), run('closures', false, { fetchedAt: '', count: 0 })], {}, now);
  const body = healthReport(health, 'someone', undefined, now);
  assert.match(body, /^<!-- failing: closures,txdot -->/);
  assert.match(body, /@someone 2 data sources are failing/);
  assert.match(body, /HTTP 500/);
  assert.match(body, /nothing, because there is no recent copy/);
});
