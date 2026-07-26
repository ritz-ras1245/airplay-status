import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getPlaybackState as getLivePlaybackState,
  onPlaybackChange,
  startMetadataWatcher,
} from './services/airplayMetadataService.js';
import { getPlaybackState as getMockPlaybackState } from './services/mockPlaybackService.js';
import { formatMs } from './utils/formatTime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;
const USE_MOCK = process.env.USE_MOCK === 'true';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

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

app.get('/', async (req, res) => {
  const { playback, forceNothingPlaying, live } = await resolvePlayback(req);

  res.render('index', {
    playback,
    forceNothingPlaying,
    live,
    formatMs,
  });
});

app.listen(PORT, () => {
  const mode = USE_MOCK ? 'mock' : 'live';
  console.log(`AirPlay Status (${mode}) at http://localhost:${PORT}`);
});
