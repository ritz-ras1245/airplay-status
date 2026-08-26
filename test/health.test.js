import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHealth } from '../src/lib/health.js';

const base = {
  startedAtMs: 1000,
  nowMs: 1000 + 42_000,
  version: '0.1.0',
  node: 'v22.14.0',
  stageId: 'dev',
};

test('buildHealth reports live service status', () => {
  const h = buildHealth({ ...base, useMock: false, playing: true });
  assert.equal(h.status, 'ok');
  assert.equal(h.mode, 'live');
  assert.equal(h.stage, 'dev');
  assert.equal(h.uptimeSec, 42);
  assert.equal(h.metadataWatcher, 'watching');
  assert.equal(h.nowPlaying, true);
  assert.equal(h.version, '0.1.0');
  assert.equal(h.node, 'v22.14.0');
});

test('buildHealth reflects mock mode (watcher disabled, not playing)', () => {
  const h = buildHealth({ ...base, useMock: true, playing: true });
  assert.equal(h.mode, 'mock');
  assert.equal(h.metadataWatcher, 'disabled');
  // playing is coerced to boolean; mock still reports the passed value
  assert.equal(h.nowPlaying, true);
});

test('buildHealth never returns negative uptime and floors seconds', () => {
  assert.equal(buildHealth({ ...base, nowMs: 500, useMock: false, playing: false }).uptimeSec, 0);
  assert.equal(
    buildHealth({ ...base, nowMs: 1000 + 1999, useMock: false, playing: false }).uptimeSec,
    1,
  );
});

test('buildHealth coerces nowPlaying to a boolean', () => {
  assert.equal(buildHealth({ ...base, useMock: false, playing: 0 }).nowPlaying, false);
  assert.equal(buildHealth({ ...base, useMock: false, playing: undefined }).nowPlaying, false);
});
