import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEinkProgress, EINK_DEFAULT_PROFILE } from '../src/lib/einkProgress.js';

const defaultProfile = {
  ...EINK_DEFAULT_PROFILE,
  showProgressBar: true,
  progressBarPx: 216,
  segmentMinPx: 24,
  segmentMax: 20,
  refreshSec: 60,
  refreshMinSec: 10,
  refreshMaxSec: 120,
};

test('segmentCount from default profile is 9 (216/24)', () => {
  const r = computeEinkProgress({
    progressMs: 0,
    durationMs: 180_000,
    isPlaying: true,
    profile: defaultProfile,
  });
  assert.equal(r.segmentCount, 9);
  assert.equal(r.progressBarPx, 216);
  assert.equal(r.showProgressBar, true);
});

test('180s track with 9 segments → refreshRateSec 20', () => {
  const r = computeEinkProgress({
    progressMs: 0,
    durationMs: 180_000,
    isPlaying: true,
    profile: defaultProfile,
  });
  assert.equal(r.segmentCount, 9);
  assert.equal(r.refreshRateSec, 20);
});

test('45s track clamps refresh to refreshMinSec 10', () => {
  const r = computeEinkProgress({
    progressMs: 0,
    durationMs: 45_000,
    isPlaying: true,
    profile: defaultProfile,
  });
  assert.equal(r.refreshRateSec, 10);
});

test('paused uses refreshSec 60 but keeps filled segments', () => {
  const r = computeEinkProgress({
    progressMs: 90_000,
    durationMs: 180_000,
    isPlaying: false,
    profile: defaultProfile,
  });
  assert.equal(r.refreshRateSec, 60);
  assert.equal(r.filledSegments, 4); // floor(90/180 * 9) = 4
  assert.match(r.progressText, /Paused$/);
  assert.equal(r.showProgressBar, true);
});

test('playing fills segments from progress ratio', () => {
  const r = computeEinkProgress({
    progressMs: 60_000,
    durationMs: 180_000,
    isPlaying: true,
    profile: defaultProfile,
  });
  assert.equal(r.filledSegments, 3); // floor(60/180 * 9) = 3
  assert.match(r.progressText, /Playing$/);
});

test('segmentCount clamps to min 3', () => {
  const r = computeEinkProgress({
    progressMs: 0,
    durationMs: 60_000,
    isPlaying: true,
    profile: { ...defaultProfile, progressBarPx: 40, segmentMinPx: 24, segmentMax: 20 },
  });
  assert.equal(r.segmentCount, 3);
});

test('segmentCount clamps to segmentMax', () => {
  const r = computeEinkProgress({
    progressMs: 0,
    durationMs: 60_000,
    isPlaying: true,
    profile: { ...defaultProfile, progressBarPx: 1000, segmentMinPx: 10, segmentMax: 9 },
  });
  assert.equal(r.segmentCount, 9);
});

test('no duration hides bar and uses idle refresh', () => {
  const r = computeEinkProgress({
    progressMs: 0,
    durationMs: 0,
    isPlaying: true,
    profile: defaultProfile,
  });
  assert.equal(r.showProgressBar, false);
  assert.equal(r.filledSegments, 0);
  assert.equal(r.refreshRateSec, 60);
});

test('showProgressBar false from profile hides bar even with duration', () => {
  const r = computeEinkProgress({
    progressMs: 30_000,
    durationMs: 180_000,
    isPlaying: true,
    profile: { ...defaultProfile, showProgressBar: false },
  });
  assert.equal(r.showProgressBar, false);
  // math still computed for refresh
  assert.equal(r.refreshRateSec, 20);
  assert.equal(r.filledSegments, 1);
});
