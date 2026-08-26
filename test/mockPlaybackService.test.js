import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMockSources, getPlaybackState } from '../src/services/mockPlaybackService.js';

test('mock sources expose different AirPlay and Spotify tracks', () => {
  const sources = getMockSources();
  assert.equal(sources.airplay.sourceId, 'airplay');
  assert.equal(sources.spotify.sourceId, 'spotify');
  assert.equal(sources.airplay.title, 'Señorita');
  assert.equal(sources.spotify.title, 'Blinding Lights');
  assert.notEqual(sources.airplay.title, sources.spotify.title);
});

test('mock nothing-playing clears both adapters', () => {
  const sources = getMockSources(true);
  assert.equal(sources.airplay.title, null);
  assert.equal(sources.spotify.title, null);
});

test('getPlaybackState stays AirPlay-shaped for callers that ignore rotation', async () => {
  const playback = await getPlaybackState();
  assert.equal(playback.sourceId, 'airplay');
  assert.equal(playback.title, 'Señorita');
});
