import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_SECRET_KEYS,
  mergeEnvFile,
  parseEnvLines,
} from '../lib/allowedSecrets.js';
import {
  clearSetupToken,
  readSetupToken,
  validateSetupToken,
} from '../lib/setupToken.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_FILE = path.join(projectRoot, '.env');

const setupActive = () => Boolean(readSetupToken());

export const registerSetupRoutes = (app) => {
  app.get('/setup', (req, res) => {
    if (!setupActive()) {
      res.status(404).send('Setup already completed or not available.');
      return;
    }
    const token = String(req.query.token ?? '');
    if (!validateSetupToken(token)) {
      res.status(403).send('Invalid or missing setup token. Use the URL from install.sh output.');
      return;
    }
    res.render('setup', {
      token,
      allowedKeys: [...ALLOWED_SECRET_KEYS].sort(),
    });
  });

  app.post('/api/setup/secrets', (req, res) => {
    if (!setupActive()) {
      res.status(410).json({ ok: false, error: 'Setup already completed' });
      return;
    }

    const { token, content } = req.body ?? {};
    if (!validateSetupToken(String(token ?? ''))) {
      res.status(403).json({ ok: false, error: 'Invalid setup token' });
      return;
    }

    const text = String(content ?? '');
    if (!text.trim()) {
      res.status(400).json({ ok: false, error: 'Empty secrets file' });
      return;
    }

    const entries = parseEnvLines(text);
    if (!entries.length) {
      res.status(400).json({
        ok: false,
        error: `No allowed keys found. Use: ${[...ALLOWED_SECRET_KEYS].join(', ')}`,
      });
      return;
    }

    const hasTidbyt = entries.some(
      (e) =>
        (e.key === 'TIDBYT_DEVICE_ID' || e.key === 'TIDBYT_API_TOKEN') && e.value,
    );
    if (!hasTidbyt) {
      res.status(400).json({
        ok: false,
        error: 'TIDBYT_DEVICE_ID and TIDBYT_API_TOKEN are required',
      });
      return;
    }

    const existing = fs.existsSync(ENV_FILE)
      ? fs.readFileSync(ENV_FILE, 'utf8')
      : '';
    fs.writeFileSync(ENV_FILE, mergeEnvFile(existing, entries), {
      encoding: 'utf8',
      mode: 0o600,
    });
    clearSetupToken();

    res.json({
      ok: true,
      applied: entries.map((e) => e.key),
      restart: 'sudo systemctl restart airplay-status',
    });
  });
};
