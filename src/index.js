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
import { formatMs } from './utils/formatTime.js';
import {
  printTidbytStartupStatus,
  resolveTidbytStartup,
  startTidbytPushService,
} from './services/tidbytPushService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;
const USE_MOCK = process.env.USE_MOCK === 'true';
const METADATA_DEBUG = process.env.METADATA_DEBUG === '1';

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
        console.warn('⚠  shairport-sync is not running — "AirPlay Status" will not appear on your iPhone.');
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

const renderDashboard = async (req, res, { showDebugCapture = false } = {}) => {
  const { playback, forceNothingPlaying, live } = await resolvePlayback(req);

  res.render('index', {
    playback,
    forceNothingPlaying,
    live,
    showDebugCapture,
    formatMs,
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
  console.log(`AirPlay Status (${mode}) at http://localhost:${PORT}`);
  if (METADATA_DEBUG) {
    console.log(`Debug capture UI at http://localhost:${PORT}/debug`);
  }

  const tidbyt = resolveTidbytStartup();
  printTidbytStartupStatus(tidbyt);

  if (tidbyt.shouldStart) {
    startTidbytPushService({
      baseUrl: `http://localhost:${PORT}`,
      deviceId: tidbyt.deviceId,
      apiToken: tidbyt.apiToken,
      installationId: tidbyt.installationId,
      getPlaybackState: async () => {
        if (USE_MOCK) return getMockPlaybackState();
        return getLivePlaybackState();
      },
      onPlaybackChange: USE_MOCK ? null : onPlaybackChange,
    });
  }
});
