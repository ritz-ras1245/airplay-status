export const DEFAULT_DISPLAY_URL = 'http://airplay-status.home.arpa:3003/echo';

export const resolveDisplayUrl = (env = process.env) =>
  env.ECHO_DISPLAY_URL?.trim() || DEFAULT_DISPLAY_URL;

export const buildOpenUrlDirective = (url = resolveDisplayUrl()) => ({
  type: 'Alexa.Presentation.APL.OpenURL',
  version: '1.5',
  url,
  options: {
    launchType: 'FULL',
  },
});

export const buildOpenNowPlayingResponse = (displayUrl = resolveDisplayUrl()) => ({
  version: '1.0',
  response: {
    outputSpeech: {
      type: 'PlainText',
      text: 'Opening now playing.',
    },
    directives: [buildOpenUrlDirective(displayUrl)],
    shouldEndSession: true,
  },
});

export const buildRoutinesTriggerAck = (requestId, name = 'AirPlayStatusNowPlaying') => ({
  version: '1.0',
  response: {
    outputSpeech: {
      type: 'PlainText',
      text: `Routine trigger ${name} registered.`,
    },
    shouldEndSession: true,
  },
  sessionAttributes: {
    routinesTriggerName: name,
  },
  ...(requestId ? { requestId } : {}),
});

export const handleSkillRequest = (event, env = process.env) => {
  const request = event?.request;
  if (!request) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing request' }),
    };
  }

  const requestType = request.type;

  if (requestType === 'LaunchRequest') {
    return {
      statusCode: 200,
      body: JSON.stringify(buildOpenNowPlayingResponse(resolveDisplayUrl(env))),
    };
  }

  if (requestType === 'IntentRequest') {
    const intentName = request.intent?.name;

    if (intentName === 'OpenNowPlayingIntent') {
      return {
        statusCode: 200,
        body: JSON.stringify(buildOpenNowPlayingResponse(resolveDisplayUrl(env))),
      };
    }

    if (intentName === 'AMAZON.HelpIntent') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'Say open airplay now playing to show the dashboard on your Echo Show.',
            },
            shouldEndSession: true,
          },
        }),
      };
    }

    if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          version: '1.0',
          response: {
            outputSpeech: { type: 'PlainText', text: 'Goodbye.' },
            shouldEndSession: true,
          },
        }),
      };
    }
  }

  if (requestType === 'Alexa.Routines.Trigger.Create') {
    const triggerName =
      request.trigger?.name || env.ALEXA_ROUTINE_TRIGGER_NAME || 'AirPlayStatusNowPlaying';
    console.log('[skill] Routines.Trigger.Create', triggerName);
    return {
      statusCode: 200,
      body: JSON.stringify(buildRoutinesTriggerAck(request.requestId, triggerName)),
    };
  }

  if (requestType === 'Alexa.Routines.Trigger.Delete') {
    const triggerName = request.trigger?.name || 'unknown';
    console.log('[skill] Routines.Trigger.Delete', triggerName);
    return {
      statusCode: 200,
      body: JSON.stringify({
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: `Routine trigger ${triggerName} removed.`,
          },
          shouldEndSession: true,
        },
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      version: '1.0',
      response: {
        outputSpeech: { type: 'PlainText', text: 'Sorry, I did not understand that.' },
        shouldEndSession: true,
      },
    }),
  };
};
