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
import { getPlaybackState as getMockPlaybackState } from './services/mockPlaybackService.js';
import {
  sendControlAction,
  setMockControlState,
} from './services/playbackControlService.js';
import {
  computeEinkDisplay,
  getControlReasonMessage,
  resolveDeviceIdFromRequest,
  resolveDeviceProfile,
} from './lib/einkDeviceProfile.js';
import { touchEinkClient, getActiveEinkProfiles } from './lib/einkClientRegistry.js';
import {
  invalidateEinkCache,
  renderEinkPng,
} from './services/einkDisplayService.js';
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
const EINK_ENABLED = process.env.EINK_ENABLED !== '0';

if (USE_MOCK) {
  setMockControlState({ available: true, reason: null });
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

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

const VALID_CONTROL_ACTIONS = new Set(['play', 'pause', 'toggle', 'next', 'prev']);

const handleControlAction = async (req, res) => {
  const action = String(req.params.action ?? '').toLowerCase();
  if (!VALID_CONTROL_ACTIONS.has(action)) {
    res.status(400).json({ ok: false, action, reason: 'invalid_action' });
    return;
  }

  let result;
  if (USE_MOCK || req.query.mock === 'true') {
    const { playback } = await resolvePlayback(req);
    result = playback.controlAvailable
      ? { ok: true, action }
      : { ok: false, action, reason: playback.controlReason ?? 'no_session' };
  } else {
    result = await sendControlAction(action);
  }

  const wantsHtml = req.accepts(['html', 'json']) === 'html';
  if (wantsHtml) {
    const params = new URLSearchParams();
    params.set('control', result.ok ? 'ok' : 'failed');
    if (result.reason) params.set('reason', result.reason);
    if (req.query.device) params.set('device', String(req.query.device));
    res.redirect(303, `/eink?${params.toString()}`);
    return;
  }

  res.json(result);
};

const renderEinkPage = async (req, res) => {
  const { playback } = await resolvePlayback(req);
  const deviceId = resolveDeviceIdFromRequest(req);
  const profile = resolveDeviceProfile(deviceId);
  touchEinkClient(profile.deviceId, 'html');

  const display = computeEinkDisplay(playback, profile);
  const controlReasonMessage = playback.controlAvailable
    ? ''
    : getControlReasonMessage(playback.controlReason);
  const controlsDisabled = !playback.controlAvailable;

  let controlFlash = null;
  let controlFlashMessage = '';
  if (req.query.control === 'ok') {
    controlFlash = 'ok';
    controlFlashMessage = 'Command sent';
  } else if (req.query.control === 'failed') {
    controlFlash = 'failed';
    controlFlashMessage = getControlReasonMessage(req.query.reason) || 'Control failed';
  }

  res.render('eink', {
    playback,
    ...display,
    deviceId: profile.deviceId,
    deviceLabel: profile.deviceLabel,
    deviceQuery: profile.deviceId !== 'default' ? `?device=${encodeURIComponent(profile.deviceId)}` : '',
    showProgressBar: profile.showProgressBar,
    airplayReceiverName: deployStage.airplayReceiverName,
    controlsDisabled,
    controlReasonMessage,
    controlFlash,
    controlFlashMessage,
    showDebugFooter: METADATA_DEBUG || req.query.debug === '1',
  });
};

const handleEinkPng = async (req, res, profileId) => {
  const { playback } = await resolvePlayback(req);
  const profile = resolveDeviceProfile(profileId);
  touchEinkClient(profile.deviceId, 'png');

  const ifNoneMatch = req.get('If-None-Match');
  const { buffer, etag } = await renderEinkPng(profile.deviceId, profile, playback);

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('ETag', etag);

  if (ifNoneMatch && ifNoneMatch === etag) {
    res.status(304).end();
    return;
  }

  res.send(buffer);
};

app.get('/api/status', async (req, res) => {
  const { playback } = await resolvePlayback(req);
  res.json(playback);
});

app.get('/api/version', (_req, res) => {
  res.json(getVersionInfo());
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

app.post('/api/control/:action', handleControlAction);

if (EINK_ENABLED) {
  app.get('/eink', renderEinkPage);
  app.get('/kindle', (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`/eink${query}`);
  });
  app.get('/api/display/kindle.png', (req, res) => handleEinkPng(req, res, 'default'));
  app.get('/api/display/:profileId.png', (req, res) => {
    const profileId = String(req.params.profileId ?? '').replace(/\.png$/i, '') || 'default';
    handleEinkPng(req, res, profileId);
  });
}

if (!USE_MOCK) {
  onPlaybackChange(() => {
    const active = getActiveEinkProfiles();
    if (active.length > 0) invalidateEinkCache(active);
  });
}

const renderDashboard = async (req, res, { showDebugCapture = false } = {}) => {
  const { playback, forceNothingPlaying, live } = await resolvePlayback(req);

  res.render('index', {
    playback,
    forceNothingPlaying,
    live,
    showDebugCapture,
    formatMs,
    deployStage,
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

app.listen(PORT, () => {
  const mode = USE_MOCK ? 'mock' : 'live';
  const { dashboardTitle, label, deployPhase } = deployStage;
  const phase = deployPhase ? ` phase=${deployPhase}` : '';
  console.log(`${dashboardTitle} v${APP_VERSION} (${mode}, ${label})${phase} at http://localhost:${PORT}`);
  console.log(`AirPlay picker name: ${deployStage.airplayReceiverName}`);
  console.log(`Version API: http://localhost:${PORT}/api/version`);
  if (EINK_ENABLED) {
    console.log(`eInk display at http://localhost:${PORT}/eink`);
  }
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
