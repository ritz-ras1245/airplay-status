import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRoutineTriggerPayload,
  handleTriggerEvent,
  validateSecret,
} from '../lambda/trigger/lib.js';

describe('trigger Lambda', () => {
  it('validateSecret accepts matching header', () => {
    assert.equal(
      validateSecret({ 'X-Echo-Push-Secret': 'abc' }, 'abc'),
      true,
    );
    assert.equal(
      validateSecret({ 'x-echo-push-secret': 'abc' }, 'abc'),
      true,
    );
    assert.equal(
      validateSecret({ 'X-Echo-Push-Secret': 'wrong' }, 'abc'),
      false,
    );
  });

  it('buildRoutineTriggerPayload is valid UNICAST shape', () => {
    const payload = buildRoutineTriggerPayload({
      triggerName: 'AirPlayStatusNowPlaying',
      userId: 'amzn1.ask.account.TEST',
    });
    assert.deepEqual(payload, {
      triggerName: 'AirPlayStatusNowPlaying',
      targetType: 'UNICAST',
      targetDetails: {
        userId: 'amzn1.ask.account.TEST',
      },
    });
  });

  it('returns 401 on bad secret', async () => {
    const result = await handleTriggerEvent(
      {
        headers: { 'X-Echo-Push-Secret': 'wrong' },
        body: JSON.stringify({ event: 'now_playing' }),
      },
      { ECHO_PUSH_SECRET: 'expected' },
    );
    assert.equal(result.statusCode, 401);
  });

  it('returns 202 on valid secret and mocked routines API', async () => {
    const fetchImpl = async () => ({ ok: true, status: 202, text: async () => '' });

    const result = await handleTriggerEvent(
      {
        headers: { 'X-Echo-Push-Secret': 'expected' },
        body: JSON.stringify({
          event: 'now_playing',
          title: 'Track',
          artist: 'Artist',
        }),
      },
      {
        ECHO_PUSH_SECRET: 'expected',
        ALEXA_TARGET_BEARER_TOKEN: 'token',
        ALEXA_TARGET_USER_ID: 'amzn1.ask.account.TEST',
        ALEXA_ROUTINE_TRIGGER_NAME: 'AirPlayStatusNowPlaying',
      },
      { fetchImpl },
    );

    assert.equal(result.statusCode, 202);
    assert.deepEqual(JSON.parse(result.body), { ok: true, event: 'now_playing' });
  });
});
