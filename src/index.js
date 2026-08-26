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
import { getMockSources } from './services/mockPlaybackService.js';
import { createSourceDisplayService } from './services/sourceDisplayService.js';
import {
  DEFAULT_PIN_MS,
  DEFAULT_ROTATE_MS,
  emptyPlayback,
  withSourceId,
} from './lib/sourceRotate.js';
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
const PORT = Number(process.env.PORT || deployStage.port);
const USE_MOCK = process.env.USE_MOCK === 'true';
const METADATA_DEBUG = process.env.METADATA_DEBUG === '1';
const ENABLE_SPOTIFY_SOURCE = process.env.ENABLE_SPOTIFY_SOURCE === '1';
const rotateMs = Number(process.env.SOURCE_ROTATE_MS) || DEFAULT_ROTATE_MS;
const pinMs = Number(process.env.SOURCE_PIN_MS) || DEFAULT_PIN_MS;
const enabledSourceIds =
  USE_MOCK || ENABLE_SPOTIFY_SOURCE ? ['airplay', 'spotify'] : ['airplay'];

const sourceBoard = createSourceDisplayService({
  listSources: () => {
    if (USE_MOCK) return getMockSources(false);
    return {
      airplay: withSourceId(getLivePlaybackState(), 'airplay'),
      ...(ENABLE_SPOTIFY_SOURCE ? { spotify: emptyPlayback('spotify') } : {}),
    };
  },
  enabledIds: enabledSourceIds,
  rotateMs,
  pinMs,
});
sourceBoard.start();

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

const pickPlayback = (board, sourceQuery) => {
  const requested = String(sourceQuery || '').toLowerCase();
  const match = board.sources.find((s) => s.id === requested);
  return match ? match.playback : board.focused;
};

const resolvePlayback = async (req) => {
  const mock = req.query.mock === 'true' || USE_MOCK;
  const forceNothingPlaying = mock && req.query.state === 'nothing';
  const live = !mock;

  if (forceNothingPlaying) {
    const empty = emptyPlayback('airplay');
    return {
      playback: empty,
      forceNothingPlaying: true,
      live: false,
      board: sourceBoard.getBoard(),
    };
  }

  if (mock && !USE_MOCK) {
    const sources = getMockSources(false);
    const requested = String(req.query.source || '').toLowerCase();
    return {
      playback: sources[requested] || sources.airplay,
      forceNothingPlaying: false,
      live: false,
      board: null,
    };
  }

  const board = sourceBoard.getBoard();
  return {
    playback: pickPlayback(board, req.query.source),
    forceNothingPlaying: false,
    live,
    board,
  };
};

app.get('/api/status', async (req, res) => {
  const { playback } = await resolvePlayback(req);
  res.json(playback);
});

app.get('/api/sources', async (req, res) => {
  if (req.query.mock === 'true' && !USE_MOCK) {
    const sources = getMockSources(req.query.state === 'nothing');
    res.json({
      productName: 'Media Status',
      focusedId: 'airplay',
      rotateMs,
      rotating: false,
      pinned: false,
      sources: [
        { id: 'airplay', label: 'AirPlay', hasTrack: Boolean(sources.airplay.title), playback: sources.airplay },
        { id: 'spotify', label: 'Spotify', hasTrack: Boolean(sources.spotify.title), playback: sources.spotify },
      ],
    });
    return;
  }
  res.json(sourceBoard.getBoard());
});

app.post('/api/sources/focus', (req, res) => {
  const sourceId = String(req.body?.sourceId || '').trim();
  if (!sourceBoard.pin(sourceId)) {
    res.status(400).json({ ok: false, error: 'unknown sourceId' });
    return;
  }
  res.json(sourceBoard.getBoard());
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

app.get('/api/events', (req, res) => {
  if (req.query.mock === 'true' || USE_MOCK) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify(sourceBoard.getFocused())}\n\n`);

  const unsubMeta = onPlaybackChange(() => {
    res.write(`data: ${JSON.stringify(sourceBoard.getFocused())}\n\n`);
  });
  const unsubFocus = sourceBoard.onFocusChange(() => {
    res.write(`data: ${JSON.stringify(sourceBoard.getFocused())}\n\n`);
  });

  req.on('close', () => {
    unsubMeta();
    unsubFocus();
  });
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

const viewLocals = (playback, live, board) => ({
  playback,
  live,
  formatMs,
  deployStage,
  board,
  productTitle: board?.productName || deployStage.dashboardTitle,
  multiSource: Boolean(board && board.sources.length > 1),
});

const renderDashboard = async (req, res, { showDebugCapture = false } = {}) => {
  const { playback, forceNothingPlaying, live, board } = await resolvePlayback(req);

  res.render('index', {
    ...viewLocals(playback, live, board),
    forceNothingPlaying,
    showDebugCapture,
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
  const { playback, live, board } = await resolvePlayback(req);
  const clientRaw = String(req.query.client || '').toLowerCase();
  const client = KIOSK_CLIENTS.has(clientRaw) ? clientRaw : '';

  res.render('display', {
    ...viewLocals(playback, live, board),
    client,
  });
};

app.get('/', handleDashboard);
app.get('/debug', handleDashboard);
app.get('/display', renderDisplay);

app.listen(PORT, () => {
  const mode = USE_MOCK ? 'mock' : 'live';
  const boardSnap = sourceBoard.getBoard();
  const title = boardSnap.productName || deployStage.dashboardTitle;
  const { label, deployPhase } = deployStage;
  const phase = deployPhase ? ` phase=${deployPhase}` : '';
  console.log(`${title} v${APP_VERSION} (${mode}, ${label})${phase} at http://localhost:${PORT}`);
  console.log(`AirPlay picker name: ${deployStage.airplayReceiverName}`);
  if (enabledSourceIds.length > 1) {
    console.log(`Sources: ${enabledSourceIds.join(', ')} (one at a time, ${rotateMs}ms)`);
  }
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
    getPlaybackState: async () => sourceBoard.getFocused(),
    onPlaybackChange: USE_MOCK ? null : onPlaybackChange,
  });

  if (!tidbyt.shouldStart && setupToken) {
    console.log('Upload Tidbyt creds at /setup?token=… — push starts immediately (no restart).');
  }
});
