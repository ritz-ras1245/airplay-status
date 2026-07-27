import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const STAR_FILE = path.join(projectRoot, 'integrations/tidbyt/airplay-status.star');
const OUTPUT_FILE = path.join('/tmp', 'airplay-status-tidbyt.webp');

const MAX_CONSECUTIVE_FAILURES = 10;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const TIDBYT_API_URL = 'https://api.tidbyt.com/v0/devices';
export const DEFAULT_TIDBYT_INSTALLATION_ID = 'airplaystatus';
const INSTALLATION_ID_PATTERN = /^[a-zA-Z0-9]+$/;

let unsubscribe = null;
let consecutiveFailures = 0;
let disabled = false;
let pushing = false;
let backoffTimer = null;
let lastPushKey = null;
let changeDebounceTimer = null;
let pushAgainAfterCurrent = false;

const log = (...args) => console.log('[tidbyt]', ...args);
const logError = (...args) => console.error('[tidbyt]', ...args);

const truthyEnv = (value) => value === '1' || value === 'true';
const falsyEnv = (value) => value === '0' || value === 'false';

const terminalColorsEnabled = () =>
  !process.env.NO_COLOR && Boolean(process.stderr?.isTTY);

const printTidbytSetupWarning = (issues) => {
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
  write(`${boldYellow}  ⚠  TIDBYT PUSH NOT STARTED${reset}`);
  write(`${boldYellow}${bar}${reset}`);
  for (const message of issues) {
    write(`${boldWhite}  • ${message}${reset}`);
  }
  write('');
  write(`${dim}  Dashboard is running — only Tidbyt push is skipped.${reset}`);
  write(`${cyan}  To hide this warning: set TIDBYT_ENABLED=0 in .env${reset}`);
  write(`${boldYellow}${bar}${reset}`);
  write('');
};

export const findPixlet = () => {
  try {
    return execSync('command -v pixlet', { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
};

export const shouldPushPlayback = (playback) =>
  Boolean(playback?.title || playback?.artist);

export const shouldClearPlayback = (playback) => !shouldPushPlayback(playback);

const CLEARED_KEY = '__cleared__';
const PUSH_DEBOUNCE_MS = 250;

export const pushStateKey = (playback) => {
  const durationMs = playback.durationMs || 0;
  const progressMs = playback.progressMs || 0;
  const progressBucket =
    durationMs > 0 ? Math.floor((progressMs / durationMs) * 20) : 0;

  return JSON.stringify({
    title: playback.title,
    artist: playback.artist,
    album: playback.album,
    albumArt: playback.albumArt,
    isPlaying: playback.isPlaying,
    progressBucket,
  });
};

export const resolveTidbytStartup = ({
  deviceId = process.env.TIDBYT_DEVICE_ID?.trim(),
  apiToken = process.env.TIDBYT_API_TOKEN?.trim(),
  enabledFlag = process.env.TIDBYT_ENABLED,
  installationId = process.env.TIDBYT_INSTALLATION_ID?.trim() || DEFAULT_TIDBYT_INSTALLATION_ID,
} = {}) => {
  const hasCreds = Boolean(deviceId && apiToken);
  const pixletPath = findPixlet();
  const explicitlyDisabled = falsyEnv(enabledFlag);
  const explicitlyEnabled = truthyEnv(enabledFlag);
  const requested = !explicitlyDisabled && (explicitlyEnabled || hasCreds);

  if (!requested) {
    return { shouldStart: false, reason: 'not configured' };
  }

  const issues = [];
  if (!hasCreds) {
    issues.push('Set TIDBYT_DEVICE_ID and TIDBYT_API_TOKEN in .env');
  }
  if (!pixletPath) {
    issues.push(
      'pixlet not found — Pi: reinstall deploy/rpi/install.sh; Mac: brew install tidbyt/tidbyt/pixlet',
    );
  }
  if (!INSTALLATION_ID_PATTERN.test(installationId)) {
    issues.push(
      `TIDBYT_INSTALLATION_ID must be alphanumeric (a-z, A-Z, 0-9) — got "${installationId}", try ${DEFAULT_TIDBYT_INSTALLATION_ID}`,
    );
  }

  if (issues.length) {
    return {
      shouldStart: false,
      requested: true,
      issues,
      pixletPath,
      hasCreds,
      deviceId,
      apiToken,
      installationId,
    };
  }

  return {
    shouldStart: true,
    requested: true,
    pixletPath,
    hasCreds,
    deviceId,
    apiToken,
    installationId,
  };
};

export const printTidbytStartupStatus = (status) => {
  if (!status.requested) return;

  if (status.shouldStart) {
    console.log('');
    console.log(`✓  Tidbyt push enabled (pixlet: ${status.pixletPath})`);
    console.log('   Pushes while playing; removes installation when session ends.');
    console.log('');
    return;
  }

  printTidbytSetupWarning(status.issues);
};

const resolveAlbumArtUrl = (albumArt, baseUrl) => {
  if (!albumArt) return null;
  if (albumArt.startsWith('http')) return albumArt;
  return `${baseUrl}${albumArt.startsWith('/') ? '' : '/'}${albumArt}`;
};

const prepareStatusForRender = (playback, baseUrl) => ({
  ...playback,
  albumArt: resolveAlbumArtUrl(playback.albumArt, baseUrl),
});

const runPixletRender = (statusJson, baseUrl) =>
  new Promise((resolve, reject) => {
    const args = [
      'render',
      STAR_FILE,
      `status=${statusJson}`,
      `base_url=${baseUrl}`,
      '-o',
      OUTPUT_FILE,
    ];

    const proc = spawn('pixlet', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    proc.on('error', (err) => {
      reject(new Error(`pixlet not found or failed to start: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pixlet render failed (${code}): ${stderr.trim() || 'unknown error'}`));
    });
  });

const pushToTidbytApi = async ({ deviceId, apiToken, installationId }) => {
  const imageBuffer = await fs.readFile(OUTPUT_FILE);
  const response = await fetch(`${TIDBYT_API_URL}/${deviceId}/push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBuffer.toString('base64'),
      installationID: installationId,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tidbyt API ${response.status}: ${body.slice(0, 200)}`);
  }
};

const removeInstallation = async ({ deviceId, apiToken, installationId }) => {
  const response = await fetch(
    `${TIDBYT_API_URL}/${deviceId}/installations/${installationId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    },
  );

  if (response.status === 404) return 'absent';
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tidbyt delete ${response.status}: ${body.slice(0, 200)}`);
  }
  return 'removed';
};

export const startTidbytPushService = ({
  getPlaybackState,
  onPlaybackChange,
  baseUrl = `http://localhost:${process.env.PORT || 3003}`,
  deviceId = process.env.TIDBYT_DEVICE_ID,
  apiToken = process.env.TIDBYT_API_TOKEN,
  installationId = process.env.TIDBYT_INSTALLATION_ID?.trim() || DEFAULT_TIDBYT_INSTALLATION_ID,
} = {}) => {
  if (typeof getPlaybackState !== 'function') {
    logError('getPlaybackState callback is required');
    return () => {};
  }

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
        if (!force && lastPushKey === CLEARED_KEY) return;

        const result = await removeInstallation({ deviceId, apiToken, installationId });

        lastPushKey = CLEARED_KEY;
        consecutiveFailures = 0;
        if (backoffTimer) {
          clearTimeout(backoffTimer);
          backoffTimer = null;
        }

        log(`removed (${reason}): installation ${installationId}${result === 'absent' ? ' (not on device)' : ''}`);
        return;
      }

      const key = pushStateKey(playback);
      if (!force && key === lastPushKey) return;

      const prepared = prepareStatusForRender(playback, baseUrl);
      const statusJson = JSON.stringify(prepared);

      await runPixletRender(statusJson, baseUrl);
      await pushToTidbytApi({ deviceId, apiToken, installationId });

      lastPushKey = key;
      consecutiveFailures = 0;
      if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }

      log(`pushed (${reason}): ${prepared.title || prepared.artist || 'track'}`);

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

  log(`enabled (installation=${installationId}, push while playing, remove when idle)`);

  if (typeof onPlaybackChange === 'function') {
    unsubscribe = onPlaybackChange(() => {
      if (changeDebounceTimer) clearTimeout(changeDebounceTimer);
      changeDebounceTimer = setTimeout(() => {
        changeDebounceTimer = null;
        pushNow('change');
      }, PUSH_DEBOUNCE_MS);
    });
  }

  pushNow('startup');

  return stop;
};
