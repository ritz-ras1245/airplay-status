import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const EXAMPLE_CONFIG = path.join(projectRoot, 'config/eink-devices.example.json');
const USER_CONFIG = path.join(projectRoot, 'config/eink-devices.json');

let cachedProfiles = null;

const loadProfiles = () => {
  if (cachedProfiles) return cachedProfiles;

  const configPath = fs.existsSync(USER_CONFIG) ? USER_CONFIG : EXAMPLE_CONFIG;
  cachedProfiles = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cachedProfiles;
};

const envNumber = (key, fallback) => {
  const raw = process.env[key];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const resolveDeviceProfile = (deviceId) => {
  const profiles = loadProfiles();
  const id = deviceId && profiles[deviceId] ? deviceId : 'default';
  const base = profiles[id] ?? profiles.default;

  return {
    deviceId: id,
    deviceLabel: base.label ?? id,
    showProgressBar: base.showProgressBar ?? false,
    progressBarPx: envNumber('EINK_PROGRESS_BAR_PX', base.progressBarPx ?? 216),
    segmentMinPx: envNumber('EINK_SEGMENT_MIN_PX', base.segmentMinPx ?? 24),
    segmentMax: envNumber('EINK_SEGMENT_MAX', base.segmentMax ?? 20),
    refreshSec: envNumber('EINK_REFRESH_SEC', base.refreshSec ?? 60),
    refreshMinSec: envNumber('EINK_REFRESH_MIN_SEC', base.refreshMinSec ?? 10),
    refreshMaxSec: envNumber('EINK_REFRESH_MAX_SEC', base.refreshMaxSec ?? 120),
    pngWidth: envNumber('EINK_WIDTH', base.pngWidth ?? 758),
    pngHeight: envNumber('EINK_HEIGHT', base.pngHeight ?? 1024),
  };
};

export const resolveDeviceIdFromRequest = (req) =>
  req.query.device || process.env.EINK_DEVICE_ID || 'default';

export const computeEinkDisplay = (playback, profile) => {
  const progressText = formatProgressText(playback);
  let segmentCount = 0;
  let filledSegments = 0;
  let refreshRateSec = profile.refreshSec;

  if (
    profile.showProgressBar &&
    playback.durationMs > 0 &&
    profile.progressBarPx > 0 &&
    profile.segmentMinPx > 0
  ) {
    segmentCount = Math.min(
      profile.segmentMax,
      Math.max(3, Math.floor(profile.progressBarPx / profile.segmentMinPx)),
    );

    if (playback.isPlaying) {
      refreshRateSec = Math.min(
        profile.refreshMaxSec,
        Math.max(
          profile.refreshMinSec,
          Math.ceil(playback.durationMs / 1000 / segmentCount),
        ),
      );
    }

    if (playback.isPlaying && playback.durationMs > 0) {
      filledSegments = Math.min(
        segmentCount,
        Math.max(0, Math.floor((playback.progressMs / playback.durationMs) * segmentCount)),
      );
    }
  }

  return {
    progressText,
    segmentCount,
    filledSegments,
    refreshRateSec,
  };
};

const formatProgressText = (playback) => {
  const fmt = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  if (!playback.durationMs) return '—';
  return `${fmt(playback.progressMs)} / ${fmt(playback.durationMs)}`;
};

export const getControlReasonMessage = (reason) => {
  switch (reason) {
    case 'no_session':
      return 'Select AirPlay Status as an output';
    case 'dacp_probe_failed':
      return 'Remote control unavailable for this session';
    case 'ios_blocked':
      return 'Your iPhone may not accept remote commands (iOS 17.4+)';
    case 'ap2_unsupported':
      return 'AirPlay 2 remote control not supported';
    default:
      return reason ? String(reason) : '';
  }
};
