import './env.js';
import express from 'express';
import path from 'path';
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
import { formatMs } from './utils/formatTime.js';
import {
  configureTidbytPush,
} from './services/tidbytPushService.js';
import { APP_VERSION, getVersionInfo } from './lib/appVersion.js';
import { getDeployStage } from './lib/deployStage.js';
import { registerSetupRoutes } from './routes/setupRoutes.js';
import { readSetupToken } from './lib/setupToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deployStage = getDeployStage();
const app = express();
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

app.get('/', handleDashboard);
app.get('/debug', handleDashboard);

app.get('/kindle', (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, `/eink${q}`);
});

app.get('/eink', async (req, res) => {
  const { playback, live } = await resolvePlayback(req);
  res.render('eink', {
    playback,
    live,
    formatMs,
    deployStage,
    controlReasonMessage,
    device: String(req.query.device || 'default'),
    controlFlash: req.query.control || null,
    controlFlashReason: req.query.reason || null,
  });
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
