import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const defaultEnvPath = path.join(projectRoot, '.env');
export const localTidbytEnvPath = path.join(projectRoot, '.local/tidbyt.env');

const parseValue = (raw) => {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const applyEnvFile = (envPath, { overwrite = false } = {}) => {
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = parseValue(trimmed.slice(eq + 1));
    if (overwrite || !(key in process.env)) {
      process.env[key] = value;
    }
  }
};

/** Mac dev: .env (stage) then .local/tidbyt.env (creds — survives beta .env refresh). */
export const loadMacEnv = () => {
  applyEnvFile(defaultEnvPath);
  applyEnvFile(localTidbytEnvPath, { overwrite: true });
};

export const loadEnvFile = (envPath = defaultEnvPath) => {
  applyEnvFile(envPath);
};

/** Re-read .env and overwrite process.env (used after one-time secrets upload). */
export const reloadEnvFile = (envPath = defaultEnvPath) => {
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = parseValue(trimmed.slice(eq + 1));
    process.env[key] = value;
  }
};
