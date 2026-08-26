import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPlayback,
  initialState,
  reduce,
  shouldKeepScreenOn,
} from '../shared/alwaysOnState.js';

const playing = { isPlaying: true, title: 'Señorita' };
const paused = { isPlaying: false, title: 'Señorita' };
const nothing = { isPlaying: false, title: null };

test('classifyPlayback', () => {
  assert.equal(classifyPlayback(playing), 'playing');
  assert.equal(classifyPlayback(paused), 'paused');
  assert.equal(classifyPlayback(nothing), 'idle');
  assert.equal(classifyPlayback(null), 'idle');
});

test('idle → play (no prior dim) wakes without a nudge', () => {
  let s = initialState();
  s = reduce(s, { type: 'playback', playback: playing });
  assert.equal(s.mode, 'playing');
  assert.equal(s.screen, 'awake');
  assert.equal(s.nudge, false);
  assert.equal(shouldKeepScreenOn(s), true);
});

test('play → idle → grace dims and records focus-before-idle', () => {
  let s = reduce(initialState(), { type: 'playback', playback: playing });
  s = reduce(s, { type: 'playback', playback: nothing });
  assert.equal(s.mode, 'idle');
  assert.equal(s.screen, 'awake'); // grace not elapsed yet
  s = reduce(s, { type: 'idleGraceElapsed', focused: true });
  assert.equal(s.screen, 'dim');
  assert.equal(s.focusBeforeIdle, true);
  assert.equal(shouldKeepScreenOn(s), false);
});

test('resume while dimmed + focus-before-idle → one-shot nudge, dismiss clears it', () => {
  let s = initialState();
  s = reduce(s, { type: 'idleGraceElapsed', focused: true }); // dim (already idle)
  s = reduce(s, { type: 'playback', playback: playing });
  assert.equal(s.nudge, true);
  assert.equal(s.screen, 'dim'); // stays dim until user taps
  s = reduce(s, { type: 'dismissNudge' });
  assert.equal(s.nudge, false);
  assert.equal(s.screen, 'awake');
});

test('resume while dimmed but NOT focus-before-idle → silent wake, no nudge', () => {
  let s = initialState();
  s = reduce(s, { type: 'idleGraceElapsed', focused: false }); // dim, unfocused
  s = reduce(s, { type: 'playback', playback: playing });
  assert.equal(s.nudge, false);
  assert.equal(s.screen, 'awake');
});

test('leaving the app before it dims clears focus-before-idle intent', () => {
  let s = initialState();
  s = reduce(s, { type: 'focusLost' });
  assert.equal(s.focusBeforeIdle, false);
  // after dim, focusLost is ignored (flag already captured)
  s = reduce(s, { type: 'idleGraceElapsed', focused: true });
  s = reduce(s, { type: 'focusLost' });
  assert.equal(s.focusBeforeIdle, true);
});
