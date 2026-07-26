import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPlaybackState } from './services/mockPlaybackService.js';
import { formatMs } from './utils/formatTime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
  const forceNothingPlaying = req.query.state === 'nothing';
  const playback = await getPlaybackState(forceNothingPlaying);

  res.render('index', {
    playback,
    forceNothingPlaying,
    formatMs,
  });
});

app.listen(PORT, () => {
  console.log(`AirPlay Status running at http://localhost:${PORT}`);
});
