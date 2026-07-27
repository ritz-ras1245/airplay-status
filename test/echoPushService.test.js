import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  buildPushBody,
  pushStateKey,
  resolveEchoStartup,
  shouldClearPlayback,
  shouldPushPlayback,
  startEchoPushService,
  DEFAULT_DISPLAY_URL,
} from '../src/services/echoPushService.js';

describe('echoPushService', () => {
  it('shouldPushPlayback when title or artist present', () => {
    assert.equal(shouldPushPlayback({ title: 'Song' }), true);
    assert.equal(shouldPushPlayback({ artist: 'Band' }), true);
    assert.equal(shouldClearPlayback({ title: null, artist: null }), true);
  });

  it('pushStateKey excludes progress buckets', () => {
    const a = pushStateKey({
      title: 'A',
      artist: 'B',
      progressMs: 1000,
      durationMs: 200000,
    });
    const b = pushStateKey({
      title: 'A',
      artist: 'B',
      progressMs: 50000,
      durationMs: 200000,
    });
    assert.equal(a, b);
  });

  it('buildPushBody matches spec shape', () => {
    const body = buildPushBody(
      { title: 'Track', artist: 'Artist', isPlaying: true },
      'http://example.test/echo',
    );
    assert.deepEqual(body, {
      event: 'now_playing',
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      displayUrl: 'http://example.test/echo',
    });
  });

  it('resolveEchoStartup auto-enables when webhook + secret set', () => {
    const status = resolveEchoStartup({
      webhookUrl: 'https://api.example/trigger',
      secret: 'sekrit',
    });
    assert.equal(status.shouldStart, true);
  });

  it('resolveEchoStartup respects ECHO_PUSH_ENABLED=0', () => {
    const status = resolveEchoStartup({
      webhookUrl: 'https://api.example/trigger',
      secret: 'sekrit',
      enabledFlag: '0',
    });
    assert.equal(status.shouldStart, false);
    assert.equal(status.reason, 'disabled');
  });

  it('posts on playback change with secret header', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, text: async () => '' };
    };

    let playback = { title: 'One', artist: 'A', isPlaying: true };
    const getPlaybackState = async () => playback;

    const listeners = [];
    const onPlaybackChange = (fn) => {
      listeners.push(fn);
      return () => listeners.splice(listeners.indexOf(fn), 1);
    };

    startEchoPushService({
      getPlaybackState,
      onPlaybackChange,
      webhookUrl: 'https://hook.test/trigger',
      secret: 'test-secret',
      displayUrl: DEFAULT_DISPLAY_URL,
      fetchImpl,
    });

    await new Promise((r) => setTimeout(r, 300));

    playback = { title: 'Two', artist: 'B', isPlaying: true };
    for (const fn of listeners) fn();

    await new Promise((r) => setTimeout(r, 300));

    assert.ok(calls.length >= 1);
    const last = calls[calls.length - 1];
    assert.equal(last.url, 'https://hook.test/trigger');
    assert.equal(last.options.headers['X-Echo-Push-Secret'], 'test-secret');
    assert.equal(JSON.parse(last.options.body).event, 'now_playing');
    assert.equal(JSON.parse(last.options.body).title, 'Two');
  });

  it('does not post on idle/clear', async () => {
    const calls = [];
    const fetchImpl = async (...args) => {
      calls.push(args);
      return { ok: true, text: async () => '' };
    };

    let playback = { title: 'Song', artist: 'A', isPlaying: true };
    const listeners = [];
    const onPlaybackChange = (fn) => {
      listeners.push(fn);
      return () => {};
    };

    startEchoPushService({
      getPlaybackState: async () => playback,
      onPlaybackChange,
      webhookUrl: 'https://hook.test/trigger',
      secret: 'test-secret',
      fetchImpl,
    });

    await new Promise((r) => setTimeout(r, 300));
    const before = calls.length;

    playback = {
      title: null,
      artist: null,
      isPlaying: false,
    };
    for (const fn of listeners) fn();
    await new Promise((r) => setTimeout(r, 300));

    assert.equal(calls.length, before);
  });
});
