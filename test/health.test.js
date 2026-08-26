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
  const h = buildHealth({ ...base, useMock: false, playing: true, sidecar: 'running' });
  assert.equal(h.status, 'ok');
  assert.equal(h.mode, 'live');
  assert.equal(h.stage, 'dev');
  assert.equal(h.uptimeSec, 42);
  assert.equal(h.metadataWatcher, 'watching');
  assert.equal(h.sidecar, 'running');
  assert.equal(h.nowPlaying, true);
  assert.equal(h.version, '0.1.0');
  assert.equal(h.node, 'v22.14.0');
});

test('buildHealth passes through live sidecar state', () => {
  assert.equal(buildHealth({ ...base, useMock: false, playing: false, sidecar: 'stopped' }).sidecar, 'stopped');
  // defaults to n/a when not provided
  assert.equal(buildHealth({ ...base, useMock: false, playing: false }).sidecar, 'n/a');
});

test('buildHealth reflects mock mode (watcher disabled, sidecar n/a)', () => {
  const h = buildHealth({ ...base, useMock: true, playing: true, sidecar: 'running' });
  assert.equal(h.mode, 'mock');
  assert.equal(h.metadataWatcher, 'disabled');
  assert.equal(h.sidecar, 'n/a'); // forced n/a under mock
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
