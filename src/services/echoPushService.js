const MAX_CONSECUTIVE_FAILURES = 10;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const PUSH_DEBOUNCE_MS = 250;
export const DEFAULT_DISPLAY_URL = 'http://airplay-status.home.arpa:3003/echo';

let unsubscribe = null;
let consecutiveFailures = 0;
let disabled = false;
let pushing = false;
let backoffTimer = null;
let lastPushKey = null;
let changeDebounceTimer = null;
let pushAgainAfterCurrent = false;

const log = (...args) => console.log('[echo]', ...args);
const logError = (...args) => console.error('[echo]', ...args);

const truthyEnv = (value) => value === '1' || value === 'true';

const terminalColorsEnabled = () =>
  !process.env.NO_COLOR && Boolean(process.stderr?.isTTY);

const printEchoSetupWarning = (issues) => {
  const bar = '═'.repeat(62);
  const color = terminalColorsEnabled();
  const boldYellow = color ? '\x1b[1;33m' : '';
  const boldWhite = color ? '\x1b[1;37m' : '';
  const cyan = color ? '\x1b[36m' : '';
  const dim = color ? '\x1b[2m' : '';
  const reset = color ? '\x1b[0m' : '';

  const write = (line = '') => {
    process.stderr.write(`${line}\n`);
  };

  write('');
  write(`${boldYellow}${bar}${reset}`);
  write(`${boldYellow}  ⚠  ECHO PUSH NOT STARTED${reset}`);
  write(`${boldYellow}${bar}${reset}`);
  for (const message of issues) {
    write(`${boldWhite}  • ${message}${reset}`);
  }
  write('');
  write(`${dim}  Dashboard is running — only Echo push is skipped.${reset}`);
  write(`${cyan}  To disable: set ECHO_PUSH_ENABLED=0 in .env or environment${reset}`);
  write(`${boldYellow}${bar}${reset}`);
  write('');
};

export const shouldPushPlayback = (playback) =>
  Boolean(playback?.title || playback?.artist);

export const shouldClearPlayback = (playback) => !shouldPushPlayback(playback);

export const pushStateKey = (playback) =>
  JSON.stringify({
    title: playback.title,
    artist: playback.artist,
    album: playback.album,
    albumArt: playback.albumArt,
    isPlaying: playback.isPlaying,
  });

export const buildPushBody = (playback, displayUrl = DEFAULT_DISPLAY_URL) => ({
  event: 'now_playing',
  title: playback.title ?? null,
  artist: playback.artist ?? null,
  isPlaying: Boolean(playback.isPlaying),
  displayUrl,
});

export const resolveEchoStartup = ({
  webhookUrl = process.env.ECHO_PUSH_WEBHOOK_URL?.trim(),
  secret = process.env.ECHO_PUSH_SECRET?.trim(),
  enabledFlag = process.env.ECHO_PUSH_ENABLED,
  displayUrl = process.env.ECHO_DISPLAY_URL?.trim() || DEFAULT_DISPLAY_URL,
} = {}) => {
  const hasCreds = Boolean(webhookUrl && secret);
  const forceDisabled = enabledFlag === '0' || enabledFlag === 'false';

  if (forceDisabled) {
    return {
      shouldStart: false,
      reason: 'disabled',
      requested: hasCreds,
      issues: hasCreds ? ['ECHO_PUSH_ENABLED=0 — Echo push suppressed'] : undefined,
      displayUrl,
    };
  }

  if (!hasCreds) {
    return { shouldStart: false, reason: 'not configured', requested: false, displayUrl };
  }

  return {
    shouldStart: true,
    requested: true,
    webhookUrl,
    secret,
    displayUrl,
  };
};

export const printEchoStartupStatus = (status) => {
  if (status.reason === 'disabled' && status.requested) {
    console.log('');
    console.log('ℹ  Echo push disabled (ECHO_PUSH_ENABLED=0)');
    console.log('');
    return;
  }

  if (!status.requested) return;

  if (status.shouldStart) {
    console.log('');
    console.log('✓  Echo push enabled (webhook on track change)');
    console.log('   Pushes while playing; no push on idle/stop.');
    console.log('');
    return;
  }

  if (status.issues?.length) {
    printEchoSetupWarning(status.issues);
  }
};

const postWebhook = async ({ webhookUrl, secret, body, fetchImpl = fetch }) => {
  const response = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Echo-Push-Secret': secret,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Echo webhook ${response.status}: ${text.slice(0, 200)}`);
  }
};

export const startEchoPushService = ({
  getPlaybackState,
  onPlaybackChange,
  webhookUrl = process.env.ECHO_PUSH_WEBHOOK_URL,
  secret = process.env.ECHO_PUSH_SECRET,
  displayUrl = process.env.ECHO_DISPLAY_URL?.trim() || DEFAULT_DISPLAY_URL,
  fetchImpl = fetch,
} = {}) => {
  if (typeof getPlaybackState !== 'function') {
    logError('getPlaybackState callback is required');
    return () => {};
  }

  disabled = false;
  consecutiveFailures = 0;
  lastPushKey = null;
  pushAgainAfterCurrent = false;

  const pushNow = async (reason = 'manual', { force = false } = {}) => {
    if (disabled) return;
    if (pushing) {
      pushAgainAfterCurrent = true;
      return;
    }

    pushing = true;
    try {
      const playback = await getPlaybackState();

      if (shouldClearPlayback(playback)) {
        log(`skipped (${reason}): idle/cleared`);
        return;
      }

      const key = pushStateKey(playback);
      if (!force && key === lastPushKey) return;

      const body = buildPushBody(playback, displayUrl);
      await postWebhook({ webhookUrl, secret, body, fetchImpl });

      lastPushKey = key;
      consecutiveFailures = 0;
      if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }

      log(`pushed (${reason}): ${body.title || body.artist || 'track'}`);

      const latest = await getPlaybackState();
      if (shouldPushPlayback(latest) && pushStateKey(latest) !== key) {
        pushAgainAfterCurrent = true;
      }
    } catch (err) {
      consecutiveFailures += 1;
      const backoffMs = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(consecutiveFailures, 8));
      logError(`push failed (${consecutiveFailures}): ${err.message}; retry in ${Math.round(backoffMs / 1000)}s`);

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        disabled = true;
        logError(`disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        return;
      }

      if (!backoffTimer) {
        backoffTimer = setTimeout(() => {
          backoffTimer = null;
          pushNow('backoff', { force: true });
        }, backoffMs);
      }
    } finally {
      pushing = false;
      if (pushAgainAfterCurrent) {
        pushAgainAfterCurrent = false;
        setImmediate(() => pushNow('queued'));
      }
    }
  };

  const stop = () => {
    if (changeDebounceTimer) {
      clearTimeout(changeDebounceTimer);
      changeDebounceTimer = null;
    }
    if (backoffTimer) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  log('enabled (push on track change, skip idle/stop)');

  if (typeof onPlaybackChange === 'function') {
    unsubscribe = onPlaybackChange(() => {
      if (changeDebounceTimer) clearTimeout(changeDebounceTimer);
      changeDebounceTimer = setTimeout(() => {
        changeDebounceTimer = null;
        pushNow('change');
      }, PUSH_DEBOUNCE_MS);
    });
  }

  return stop;
};

let echoStopFn = null;
let echoRuntime = null;

export const configureEchoPush = (runtime) => {
  echoRuntime = runtime;
  return applyEchoPush();
};

export const reloadEchoPush = () => applyEchoPush();

const applyEchoPush = () => {
  if (echoStopFn) {
    echoStopFn();
    echoStopFn = null;
  }

  const status = resolveEchoStartup();
  printEchoStartupStatus(status);

  if (status.shouldStart && echoRuntime) {
    echoStopFn = startEchoPushService({
      ...echoRuntime,
      webhookUrl: status.webhookUrl,
      secret: status.secret,
      displayUrl: status.displayUrl,
    });
  }

  return status;
};
