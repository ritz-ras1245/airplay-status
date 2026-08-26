import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSourceDisplayService } from '../src/services/sourceDisplayService.js';

const track = (title, sourceId) => ({
  isPlaying: true,
  title,
  artist: 'Artist',
  album: 'Album',
  albumArt: '/images/album-art.png',
  progressMs: 1000,
  durationMs: 200000,
  source: sourceId === 'spotify' ? 'Spotify' : 'AirPlay',
  updatedAt: '2026-08-26T00:00:00.000Z',
});

const idle = { isPlaying: false, title: null };

test('rotates airplay → spotify after rotateMs when both have tracks', () => {
  let t = 0;
  const svc = createSourceDisplayService({
    listSources: () => ({
      airplay: track('Señorita', 'airplay'),
      spotify: track('Blinding Lights', 'spotify'),
    }),
    enabledIds: ['airplay', 'spotify'],
    rotateMs: 8000,
    now: () => t,
  });

  assert.equal(svc.getFocused().title, 'Señorita');
  assert.equal(svc.getBoard().productName, 'Media Status');
  assert.equal(svc.getBoard().rotating, true);

  t = 7999;
  svc.tick();
  assert.equal(svc.getFocused().title, 'Señorita');

  t = 8000;
  svc.tick();
  assert.equal(svc.getFocused().sourceId, 'spotify');
  assert.equal(svc.getFocused().title, 'Blinding Lights');

  t = 16000;
  svc.tick();
  assert.equal(svc.getFocused().sourceId, 'airplay');
});

test('does not rotate when only one source has a track', () => {
  let t = 0;
  const svc = createSourceDisplayService({
    listSources: () => ({
      airplay: track('Señorita', 'airplay'),
      spotify: idle,
    }),
    enabledIds: ['airplay', 'spotify'],
    rotateMs: 8000,
    now: () => t,
  });

  t = 8000;
  svc.tick();
  assert.equal(svc.getFocused().sourceId, 'airplay');
  assert.equal(svc.getBoard().rotating, false);
});

test('live airplay-only board keeps AirPlay product name', () => {
  const svc = createSourceDisplayService({
    listSources: () => ({ airplay: track('Señorita', 'airplay') }),
    enabledIds: ['airplay'],
    now: () => 0,
  });
  assert.equal(svc.getBoard().productName, null);
  assert.equal(svc.getBoard().sources.length, 1);
  assert.equal(svc.getFocused().sourceId, 'airplay');
});

test('pin holds focus until pinMs elapses', () => {
  let t = 0;
  const svc = createSourceDisplayService({
    listSources: () => ({
      airplay: track('Señorita', 'airplay'),
      spotify: track('Blinding Lights', 'spotify'),
    }),
    enabledIds: ['airplay', 'spotify'],
    rotateMs: 8000,
    pinMs: 30_000,
    now: () => t,
  });

  assert.equal(svc.pin('spotify'), true);
  assert.equal(svc.getBoard().pinned, true);
  assert.equal(svc.getFocused().sourceId, 'spotify');

  t = 8000;
  svc.tick();
  assert.equal(svc.getFocused().sourceId, 'spotify');

  t = 30_000;
  svc.tick();
  // pin expired at t=30000; current is still spotify (still visible)
  assert.equal(svc.getBoard().pinned, false);
  assert.equal(svc.getFocused().sourceId, 'spotify');

  t = 38_000;
  svc.tick();
  assert.equal(svc.getFocused().sourceId, 'airplay');
});

test('pin rejects unknown source ids', () => {
  const svc = createSourceDisplayService({
    listSources: () => ({ airplay: track('A', 'airplay') }),
    enabledIds: ['airplay'],
    now: () => 0,
  });
  assert.equal(svc.pin('spotify'), false);
});
