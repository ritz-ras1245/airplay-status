const ROUTINES_API_URL = 'https://api.amazonalexa.com/v1/routines/triggerInstances';

const headerValue = (headers, name) => {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
};

export const validateSecret = (headers, expectedSecret) => {
  if (!expectedSecret) return false;
  const provided = headerValue(headers, 'x-echo-push-secret');
  return provided === expectedSecret;
};

export const buildRoutineTriggerPayload = ({
  triggerName = process.env.ALEXA_ROUTINE_TRIGGER_NAME || 'AirPlayStatusNowPlaying',
  userId = process.env.ALEXA_TARGET_USER_ID,
} = {}) => ({
  triggerName,
  targetType: 'UNICAST',
  targetDetails: {
    userId,
  },
});

export const triggerRoutine = async ({
  fetchImpl = fetch,
  bearerToken = process.env.ALEXA_TARGET_BEARER_TOKEN,
  payload = buildRoutineTriggerPayload(),
} = {}) => {
  if (!bearerToken) {
    throw new Error('ALEXA_TARGET_BEARER_TOKEN is not configured');
  }
  if (!payload?.targetDetails?.userId) {
    throw new Error('ALEXA_TARGET_USER_ID is not configured');
  }

  const response = await fetchImpl(ROUTINES_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Routines API ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.status;
};

export const handleTriggerEvent = async (event, env = process.env, deps = {}) => {
  const fetchImpl = deps.fetchImpl || fetch;

  if (!validateSecret(event.headers, env.ECHO_PUSH_SECRET)) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  let parsedBody = {};
  if (event.body) {
    try {
      parsedBody = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }
  }

  if (parsedBody.event && parsedBody.event !== 'now_playing') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unsupported event' }),
    };
  }

  try {
    await triggerRoutine({
      fetchImpl,
      bearerToken: env.ALEXA_TARGET_BEARER_TOKEN,
      payload: buildRoutineTriggerPayload({
        triggerName: env.ALEXA_ROUTINE_TRIGGER_NAME,
        userId: env.ALEXA_TARGET_USER_ID,
      }),
    });
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }

  return {
    statusCode: 202,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, event: parsedBody.event || 'now_playing' }),
  };
};
