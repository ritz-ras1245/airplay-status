import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EINK_DEFAULT_PROFILE } from './einkProgress.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.resolve(__dirname, '../../config');

const EMBEDDED_DEFAULTS = {
  default: {
    label: 'Generic / unidentified eInk',
    ...EINK_DEFAULT_PROFILE,
    showProgressBar: true,
    pngWidth: 600,
    pngHeight: 800,
  },
};

let cached = null;

function readDevicesFile() {
  const candidates = [
    path.join(CONFIG_DIR, 'eink-devices.json'),
    path.join(CONFIG_DIR, 'eink-devices.example.json'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        return JSON.parse(raw);
      }
    } catch {
      // fall through
    }
  }
  return null;
}

/** Load all device profiles (cached). */
export function loadEinkDevices() {
  if (cached) return cached;
  const fromDisk = readDevicesFile();
  cached = fromDisk && typeof fromDisk === 'object' ? fromDisk : { ...EMBEDDED_DEFAULTS };
  return cached;
}

/** Resolve profile by id; falls back to default, then embedded defaults. */
export function getEinkProfile(deviceId) {
  const devices = loadEinkDevices();
  const id = String(deviceId || 'default');
  if (devices[id]) return { id, ...devices[id] };
  if (devices.default) return { id: 'default', ...devices.default };
  return { id: 'default', ...EMBEDDED_DEFAULTS.default };
}

/** Test helper — clear cache between tests if needed. */
export function clearEinkDevicesCache() {
  cached = null;
}
