import './env.js';
import express from 'express';
import path from 'path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import {
  getPlaybackState as getLivePlaybackState,
  logTestMarker,
  onPlaybackChange,
  startMetadataWatcher,
} from './services/airplayMetadataService.js';
import { getPlaybackState as getMockPlaybackState, applyMockControl } from './services/mockPlaybackService.js';
import { sendControlAction } from './services/playbackControlService.js';
import { controlReasonMessage } from './lib/controlReasons.js';
import { getEinkProfile } from './lib/einkDevices.js';
import { computeEinkProgress } from './lib/einkProgress.js';
import { formatMs } from './utils/formatTime.js';
import {
  configureTidbytPush,
} from './services/tidbytPushService.js';
import { APP_VERSION, getVersionInfo } from './lib/appVersion.js';
import { getDeployStage } from './lib/deployStage.js';
import { buildHealth } from './lib/health.js';
import { registerSetupRoutes } from './routes/setupRoutes.js';
import { readSetupToken } from './lib/setupToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deployStage = getDeployStage();
const STARTED_AT_MS = Date.now();
const app = express();
// Prefer generic errors over Express default stack pages in beta/prod.
if (process.env.NODE_ENV !== 'development') {
  app.set('env', 'production');
}
const PORT = Number(process.env.PORT || deployStage.port);
const USE_MOCK = process.env.USE_MOCK === 'true';
const METADATA_DEBUG = process.env.METADATA_DEBUG === '1';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

if (!USE_MOCK) {
  startMetadataWatcher();
  if (!process.env.SKIP_SHAIRPORT_CHECK) {
    import('node:child_process').then(({ execSync }) => {
      try {
        execSync('pgrep -f "shairport-sync -c"', { stdio: 'ignore' });
      } catch {
        console.warn('');
        console.warn(`⚠  shairport-sync is not running — "${deployStage.airplayReceiverName}" will not appear on your iPhone.`);
        console.warn('   In another terminal: ./bin/run-shairport.sh');
        console.warn('   Or use: ./bin/run-local.sh (starts both)');
        console.warn('');
      }
    });
  }
}

const resolvePlayback = async (req) => {
  if (req.query.mock === 'true' || USE_MOCK) {
    const forceNothingPlaying = req.query.state === 'nothing';
    return {
      playback: await getMockPlaybackState(forceNothingPlaying),
      forceNothingPlaying,
      live: false,
    };
  }

  return {
    playback: getLivePlaybackState(),
    forceNothingPlaying: false,
    live: true,
  };
};

app.get('/api/status', async (req, res) => {
  const { playback } = await resolvePlayback(req);
  res.json(playback);
});

app.get('/api/version', (_req, res) => {
  res.json(getVersionInfo());
});

const sidecarStatus = () => {
  if (USE_MOCK) return 'n/a';
  try {
    // Match by exact process name; pgrep -f would also match this call's own
    // invoking shell (its cmdline contains the pattern) and false-positive.
    execSync('pgrep -x shairport-sync', { stdio: 'ignore' });
    return 'running';
  } catch {
    return 'stopped';
  }
};

app.get('/api/health', (_req, res) => {
  const info = getVersionInfo();
  const live = USE_MOCK ? null : getLivePlaybackState();
  const playing = !USE_MOCK && Boolean(live && (live.isPlaying || live.title));

  res.json(
    buildHealth({
      startedAtMs: STARTED_AT_MS,
      nowMs: Date.now(),
      useMock: USE_MOCK,
      playing,
      version: info.version,
      node: info.node,
      stageId: deployStage.id,
      sidecar: sidecarStatus(),
    }),
  );
});

const CONTROL_ACTIONS = new Set(['play', 'pause', 'toggle', 'next', 'prev']);

const controlWantsRedirect = (req) => {
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/x-www-form-urlencoded')) return true;
  if (req.query.redirect === 'eink' || req.query.redirect === 'web') return true;
  if (!req.headers.accept) return false;
  return req.accepts(['html', 'json']) === 'html';
};

const safeReturnPath = (req) => {
  const raw = String(req.body?.returnTo || req.query.returnTo || '');
  if (raw === '/') return '/';
  if (raw.startsWith('/eink')) return '/eink';
  return '/eink';
};

app.post('/api/control/:action', async (req, res) => {
  const action = req.params.action;
  if (!CONTROL_ACTIONS.has(action)) {
    const body = { ok: false, action, reason: 'control_unavailable' };
    if (controlWantsRedirect(req)) {
      const dest = safeReturnPath(req);
      const q = new URLSearchParams({ control: 'failed', reason: 'control_unavailable' });
      if (req.body?.device || req.query.device) q.set('device', String(req.body?.device || req.query.device));
      return res.redirect(303, `${dest}?${q}`);
    }
    return res.status(400).json(body);
  }

  const result =
    req.query.mock === 'true' || USE_MOCK
      ? applyMockControl(action)
      : await sendControlAction(action);

  if (controlWantsRedirect(req)) {
    const dest = safeReturnPath(req);
    const q = new URLSearchParams({
      control: result.ok ? 'ok' : 'failed',
    });
    if (!result.ok && result.reason) q.set('reason', result.reason);
    const device = req.body?.device || req.query.device;
    if (device) q.set('device', String(device));
    if (USE_MOCK || req.query.mock === 'true') q.set('mock', 'true');
    return res.redirect(303, `${dest}?${q}`);
  }

  res.json(result);
});

app.get('/api/events', (req, res) => {
  if (req.query.mock === 'true' || USE_MOCK) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify(getLivePlaybackState())}\n\n`);

  const unsubscribe = onPlaybackChange((playback) => {
    res.write(`data: ${JSON.stringify(playback)}\n\n`);
  });

  req.on('close', () => unsubscribe());
});

app.post('/api/debug/mark', (req, res) => {
  if (!METADATA_DEBUG) {
    res.status(404).json({ ok: false, error: 'debug mode not enabled' });
    return;
  }
  const label = String(req.body?.label ?? 'step').trim().slice(0, 120);
  if (!label) {
    res.status(400).json({ ok: false, error: 'label required' });
    return;
  }
  logTestMarker(label);
  res.json({ ok: true, label });
});

registerSetupRoutes(app);

const renderDashboard = async (req, res, { showDebugCapture = false } = {}) => {
  const { playback, forceNothingPlaying, live } = await resolvePlayback(req);

  res.render('index', {
    playback,
    forceNothingPlaying,
    live,
    showDebugCapture,
    formatMs,
    deployStage,
    controlReasonMessage,
    controlFlash: req.query.control || null,
    controlFlashReason: req.query.reason || null,
  });
};

const handleDashboard = (req, res) => {
  const wantsDebug = req.path === '/debug' || req.query.debug === '1';
  if (wantsDebug && !METADATA_DEBUG) {
    res.redirect('/');
    return;
  }
  renderDashboard(req, res, { showDebugCapture: wantsDebug && METADATA_DEBUG });
};

const KIOSK_CLIENTS = new Set(['android', 'deskthing', 'ipad']);

const renderDisplay = async (req, res) => {
  const { playback, live } = await resolvePlayback(req);
  const clientRaw = String(req.query.client || '').toLowerCase();
  const client = KIOSK_CLIENTS.has(clientRaw) ? clientRaw : '';

  res.render('display', {
    playback,
    live,
    formatMs,
    deployStage,
    client,
  });
};

app.get('/', handleDashboard);
app.get('/debug', handleDashboard);
app.get('/display', renderDisplay);

app.get('/kindle', (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, `/eink${q}`);
});

app.get('/eink', async (req, res) => {
  const { playback, live } = await resolvePlayback(req);
  const deviceId = String(req.query.device || process.env.EINK_DEVICE_ID || 'default');
  const profile = getEinkProfile(deviceId);
  const einkProgress = computeEinkProgress({
    progressMs: playback.progressMs,
    durationMs: playback.durationMs,
    isPlaying: playback.isPlaying,
    profile,
  });
  res.render('eink', {
    playback,
    live,
    formatMs,
    deployStage,
    controlReasonMessage,
    device: profile.id,
    deviceLabel: profile.label || profile.id,
    controlFlash: req.query.control || null,
    controlFlashReason: req.query.reason || null,
    ...einkProgress,
  });
});


const safeErrorPage = () => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Something went wrong</title>
<style>body{font-family:sans-serif;background:#fff;color:#000;padding:1.5rem;text-align:center}a{color:#000}</style>
</head><body>
  <h1>Something went wrong</h1>
  <p>Try refreshing. If it keeps happening, reopen this page later.</p>
  <p><a href="/eink">Back to eInk</a> · <a href="/">Dashboard</a></p>
</body></html>`;

// Never leak stacks / paths / internals to browsers (eInk + web).
app.use((err, req, res, _next) => {
  console.error('[http]', err?.stack || err);
  if (res.headersSent) return;
  const status = Number(err?.status || err?.statusCode) || 500;
  const wantsHtml =
    req.accepts(['html', 'json']) === 'html' ||
    String(req.path || '').startsWith('/eink') ||
    req.path === '/kindle';
  if (wantsHtml) {
    res.status(status).type('html').send(safeErrorPage());
    return;
  }
  res.status(status).json({ ok: false, error: 'Something went wrong' });
});

app.listen(PORT, () => {
  const mode = USE_MOCK ? 'mock' : 'live';
  const { dashboardTitle, label, deployPhase } = deployStage;
  const phase = deployPhase ? ` phase=${deployPhase}` : '';
  console.log(`${dashboardTitle} v${APP_VERSION} (${mode}, ${label})${phase} at http://localhost:${PORT}`);
  console.log(`AirPlay picker name: ${deployStage.airplayReceiverName}`);
  console.log(`Version API: http://localhost:${PORT}/api/version`);
  if (METADATA_DEBUG) {
    console.log(`Debug capture UI at http://localhost:${PORT}/debug`);
  }

  const setupToken = readSetupToken();
  if (setupToken) {
    console.log('');
    console.log('Tidbyt/secrets setup (one-time): open /setup?token=… from install summary');
    console.log('');
  }

  const tidbyt = configureTidbytPush({
    baseUrl: `http://localhost:${PORT}`,
    getPlaybackState: async () => {
      if (USE_MOCK) return getMockPlaybackState();
      return getLivePlaybackState();
    },
    onPlaybackChange: USE_MOCK ? null : onPlaybackChange,
  });

  if (!tidbyt.shouldStart && setupToken) {
    console.log('Upload Tidbyt creds at /setup?token=… — push starts immediately (no restart).');
  }
});
