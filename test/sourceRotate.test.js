import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_NAME,
  emptyPlayback,
  hasTrack,
  nextFocusId,
  resolveFocus,
  visibleSourceIds,
  withSourceId,
} from '../src/lib/sourceRotate.js';

test('hasTrack is true only when a title is present', () => {
  assert.equal(hasTrack(null), false);
  assert.equal(hasTrack({}), false);
  assert.equal(hasTrack({ title: null }), false);
  assert.equal(hasTrack({ title: 'Señorita' }), true);
});

test('visibleSourceIds skips idle adapters and respects enabled order', () => {
  const sources = {
    airplay: { title: 'A' },
    spotify: { title: null },
  };
  assert.deepEqual(visibleSourceIds(sources, ['airplay', 'spotify']), ['airplay']);
  assert.deepEqual(
    visibleSourceIds({ airplay: { title: 'A' }, spotify: { title: 'B' } }, [
      'airplay',
      'spotify',
    ]),
    ['airplay', 'spotify'],
  );
});

test('nextFocusId cycles airplay → spotify → airplay', () => {
  const ids = ['airplay', 'spotify'];
  assert.equal(nextFocusId(ids, 'airplay'), 'spotify');
  assert.equal(nextFocusId(ids, 'spotify'), 'airplay');
  assert.equal(nextFocusId(['airplay'], 'airplay'), 'airplay');
  assert.equal(nextFocusId([], 'airplay'), null);
  assert.equal(nextFocusId(ids, 'missing'), 'airplay');
});

test('resolveFocus keeps pin while valid, else current, else first visible', () => {
  const visible = ['airplay', 'spotify'];
  assert.equal(
    resolveFocus({
      visibleIds: visible,
      currentId: 'airplay',
      pinnedId: 'spotify',
      nowMs: 1000,
      pinUntilMs: 5000,
    }),
    'spotify',
  );
  assert.equal(
    resolveFocus({
      visibleIds: visible,
      currentId: 'airplay',
      pinnedId: 'spotify',
      nowMs: 5000,
      pinUntilMs: 5000,
    }),
    'airplay',
  );
  assert.equal(
    resolveFocus({
      visibleIds: ['spotify'],
      currentId: 'airplay',
      pinnedId: null,
      nowMs: 0,
      pinUntilMs: 0,
    }),
    'spotify',
  );
  assert.equal(
    resolveFocus({
      visibleIds: [],
      currentId: 'airplay',
      pinnedId: null,
      nowMs: 0,
      pinUntilMs: 0,
    }),
    null,
  );
});

test('withSourceId stamps adapter id without dropping existing source label', () => {
  const stamped = withSourceId({ title: 'X', source: 'Music' }, 'airplay');
  assert.equal(stamped.sourceId, 'airplay');
  assert.equal(stamped.source, 'Music');
  assert.equal(emptyPlayback('spotify').source, 'Spotify');
  assert.equal(PRODUCT_NAME, 'Media Status');
});
