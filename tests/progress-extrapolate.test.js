import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMetadataUpdate,
  createEmptyPlaybackState,
  effectiveProgressMs,
  toPublicState,
} from '../src/lib/metadataParser.js';

test('effectiveProgressMs advances while playing from anchor', () => {
  const state = {
    ...createEmptyPlaybackState(),
    isPlaying: true,
    progressMs: 10_000,
    durationMs: 180_000,
    progressAnchorAt: 1_000_000,
  };
  assert.equal(effectiveProgressMs(state, 1_000_000 + 5_000), 15_000);
});

test('effectiveProgressMs clamps to duration', () => {
  const state = {
    ...createEmptyPlaybackState(),
    isPlaying: true,
    progressMs: 170_000,
    durationMs: 180_000,
    progressAnchorAt: 1_000_000,
  };
  assert.equal(effectiveProgressMs(state, 1_000_000 + 30_000), 180_000);
});

test('effectiveProgressMs freezes when paused', () => {
  const state = {
    ...createEmptyPlaybackState(),
    isPlaying: false,
    progressMs: 40_000,
    durationMs: 180_000,
    progressAnchorAt: null,
  };
  assert.equal(effectiveProgressMs(state, 1_000_000 + 60_000), 40_000);
});

test('title change clears duration so bar cannot stick on prior track', () => {
  let state = {
    ...createEmptyPlaybackState(),
    isPlaying: true,
    streamOpen: true,
    title: 'A',
    progressMs: 50_000,
    durationMs: 200_000,
    progressAnchorAt: Date.now(),
  };
  state = applyMetadataUpdate(state, { type: 'field', field: 'title', value: 'B' });
  assert.equal(state.progressMs, 0);
  assert.equal(state.durationMs, 0);
});

test('toPublicState uses extrapolated progress', () => {
  const now = Date.now();
  const state = {
    ...createEmptyPlaybackState(),
    isPlaying: true,
    title: 'T',
    progressMs: 20_000,
    durationMs: 100_000,
    progressAnchorAt: now - 8_000,
  };
  const pub = toPublicState(state);
  assert.ok(pub.progressMs >= 27_000 && pub.progressMs <= 29_000);
});
