import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(projectRoot, 'config/eink-devices.json');
const EXAMPLE_PATH = path.join(projectRoot, 'config/eink-devices.example.json');

const ENV_INT = {
  progressBarPx: 'EINK_PROGRESS_BAR_PX',
  segmentMinPx: 'EINK_SEGMENT_MIN_PX',
  segmentMax: 'EINK_SEGMENT_MAX',
  refreshSec: 'EINK_REFRESH_SEC',
  refreshMinSec: 'EINK_REFRESH_MIN_SEC',
  refreshMaxSec: 'EINK_REFRESH_MAX_SEC',
  pngWidth: 'EINK_WIDTH',
  pngHeight: 'EINK_HEIGHT',
};

let cachedDevices = null;

const loadDevices = () => {
  if (cachedDevices) return cachedDevices;

  const configPath = fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : EXAMPLE_PATH;
  cachedDevices = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cachedDevices;
};

const applyEnvOverrides = (profile) => {
  const merged = { ...profile };

  for (const [field, envKey] of Object.entries(ENV_INT)) {
    const raw = process.env[envKey];
    if (raw == null || raw === '') continue;
    const value = Number(raw);
    if (Number.isFinite(value)) merged[field] = value;
  }

  return merged;
};

/** @param {string | undefined | null} deviceId */
export const resolveDeviceId = (deviceId) => {
  const id = (deviceId || process.env.EINK_DEVICE_ID || 'default').trim().toLowerCase();
  return id || 'default';
};

/** @param {string | undefined | null} deviceId */
export const getDeviceProfile = (deviceId) => {
  const devices = loadDevices();
  const id = resolveDeviceId(deviceId);
  const base = devices[id] ?? devices.default;
  const profile = applyEnvOverrides(base);

  return {
    deviceId: devices[id] ? id : 'default',
    requestedId: id,
    profile,
  };
};

export const listDeviceProfiles = () => loadDevices();
