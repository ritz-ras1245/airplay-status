import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPlayback,
  isActive,
  shouldHoldWakeLock,
  shouldNudgeResume,
} from '../src/public/js/displayState.js';

test('classifyPlayback maps snapshots to display modes', () => {
  assert.equal(classifyPlayback(null), 'idle');
  assert.equal(classifyPlayback(undefined), 'idle');
  assert.equal(classifyPlayback({}), 'idle');
  assert.equal(classifyPlayback({ isPlaying: false, title: null }), 'idle');
  assert.equal(classifyPlayback({ isPlaying: true, title: 'Señorita' }), 'playing');
  assert.equal(classifyPlayback({ isPlaying: false, title: 'Señorita' }), 'paused');
  // A live isPlaying flag counts as active even before a title arrives.
  assert.equal(classifyPlayback({ isPlaying: true }), 'playing');
});

test('isActive and shouldHoldWakeLock track active modes', () => {
  assert.equal(isActive('playing'), true);
  assert.equal(isActive('paused'), true);
  assert.equal(isActive('idle'), false);

  assert.equal(shouldHoldWakeLock('playing'), true);
  assert.equal(shouldHoldWakeLock('paused'), true);
  assert.equal(shouldHoldWakeLock('idle'), false);
});

test('shouldNudgeResume fires only for a focused, dimmed session that resumed', () => {
  assert.equal(
    shouldNudgeResume({ focusBeforeIdle: true, screenDimmed: true, startedPlaying: true }),
    true,
  );
  // Not the focused session that dimmed → stay silent.
  assert.equal(
    shouldNudgeResume({ focusBeforeIdle: false, screenDimmed: true, startedPlaying: true }),
    false,
  );
  // Screen never dimmed → no nudge needed.
  assert.equal(
    shouldNudgeResume({ focusBeforeIdle: true, screenDimmed: false, startedPlaying: true }),
    false,
  );
  // Playback did not just start → no nudge.
  assert.equal(
    shouldNudgeResume({ focusBeforeIdle: true, screenDimmed: true, startedPlaying: false }),
    false,
  );
});
