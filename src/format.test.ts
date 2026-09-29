import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fmtMoney, fmtWhen, toYear } from './format.ts';

test('fmtMoney abbreviates to a readable scale', () => {
  assert.equal(fmtMoney(1_736_503_510), '$1.7B');
  assert.equal(fmtMoney(79_500_000), '$79.5M');
  assert.equal(fmtMoney(476_620_158), '$477M');
  assert.equal(fmtMoney(13_000_000), '$13M');
});

test('fmtWhen handles bare years, months and full dates', () => {
  assert.equal(fmtWhen('2031'), '2031');
  assert.equal(fmtWhen('2029-01'), 'Jan 2029');
  assert.equal(fmtWhen('2026-06-06'), 'Jun 2026');
});

test('toYear treats a bare end year as the end of that year', () => {
  assert.equal(toYear('2027'), 2027);
  assert.equal(toYear('2027', 'end'), 2028);
  assert.ok(Math.abs(toYear('2026-07-02') - 2026.5) < 0.01);
});
