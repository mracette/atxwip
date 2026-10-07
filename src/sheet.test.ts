import assert from 'node:assert/strict';
import { test } from 'node:test';
import { swipeMovesSheet } from './sheet.ts';

test('swiping the content of a peeking sheet always moves the sheet', () => {
  assert.equal(swipeMovesSheet('peek', -10, 0), true);
  assert.equal(swipeMovesSheet('peek', 10, 0), true);
});

test('swiping up grows the sheet until it is full, then scrolls', () => {
  assert.equal(swipeMovesSheet('half', -10, 0), true);
  assert.equal(swipeMovesSheet('full', -10, 0), false);
});

test('swiping down scrolls back to the top before it shrinks the sheet', () => {
  assert.equal(swipeMovesSheet('full', 10, 120), false);
  assert.equal(swipeMovesSheet('full', 10, 0), true);
  assert.equal(swipeMovesSheet('half', 10, 0), true);
});
