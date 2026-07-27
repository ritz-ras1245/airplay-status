import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOpenNowPlayingResponse,
  buildOpenUrlDirective,
  handleSkillRequest,
  DEFAULT_DISPLAY_URL,
} from '../lambda/skill/lib.js';

describe('skill Lambda', () => {
  it('buildOpenUrlDirective includes OpenURL APL', () => {
    const directive = buildOpenUrlDirective('http://192.168.1.10:3003/echo');
    assert.equal(directive.type, 'Alexa.Presentation.APL.OpenURL');
    assert.equal(directive.version, '1.5');
    assert.equal(directive.url, 'http://192.168.1.10:3003/echo');
    assert.equal(directive.options.launchType, 'FULL');
  });

  it('OpenNowPlayingIntent returns OpenURL directive', () => {
    const result = handleSkillRequest(
      {
        request: {
          type: 'IntentRequest',
          intent: { name: 'OpenNowPlayingIntent' },
        },
      },
      { ECHO_DISPLAY_URL: 'http://lan.test/echo' },
    );

    assert.equal(result.statusCode, 200);
    const body = JSON.parse(result.body);
    assert.equal(body.response.directives.length, 1);
    assert.equal(body.response.directives[0].type, 'Alexa.Presentation.APL.OpenURL');
    assert.equal(body.response.directives[0].url, 'http://lan.test/echo');
  });

  it('LaunchRequest opens default display URL', () => {
    const result = handleSkillRequest({
      request: { type: 'LaunchRequest' },
    });
    const body = JSON.parse(result.body);
    assert.equal(body.response.directives[0].url, DEFAULT_DISPLAY_URL);
  });

  it('Routines.Trigger.Create acknowledges', () => {
    const result = handleSkillRequest({
      request: {
        type: 'Alexa.Routines.Trigger.Create',
        trigger: { name: 'AirPlayStatusNowPlaying' },
        requestId: 'req-1',
      },
    });
    const body = JSON.parse(result.body);
    assert.match(body.response.outputSpeech.text, /AirPlayStatusNowPlaying/);
  });
});
