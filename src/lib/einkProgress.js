import { formatMs } from '../utils/formatTime.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const DEFAULT_PROFILE = {
  showProgressBar: true,
  progressBarPx: 216,
  segmentMinPx: 24,
  segmentMax: 20,
  refreshSec: 60,
  refreshMinSec: 10,
  refreshMaxSec: 120,
};

/**
 * Compute eInk segmented progress + adaptive meta-refresh (P3 locked math).
 * @param {{ progressMs?: number, durationMs?: number, isPlaying?: boolean, profile?: object }} opts
 */
export function computeEinkProgress({
  progressMs = 0,
  durationMs = 0,
  isPlaying = false,
  profile = {},
} = {}) {
  const p = { ...DEFAULT_PROFILE, ...profile };

  const minSegmentPx = Number(p.segmentMinPx) || DEFAULT_PROFILE.segmentMinPx;
  const barWidthPx = Number(p.progressBarPx) || DEFAULT_PROFILE.progressBarPx;
  const segmentMax = Number(p.segmentMax) || DEFAULT_PROFILE.segmentMax;
  const refreshSec = Number(p.refreshSec) || DEFAULT_PROFILE.refreshSec;
  const refreshMinSec = Number(p.refreshMinSec) || DEFAULT_PROFILE.refreshMinSec;
  const refreshMaxSec = Number(p.refreshMaxSec) || DEFAULT_PROFILE.refreshMaxSec;

  const segmentCount = clamp(Math.floor(barWidthPx / minSegmentPx), 3, segmentMax);

  const dur = Number(durationMs) || 0;
  const prog = Math.max(0, Number(progressMs) || 0);
  const playing = Boolean(isPlaying);
  const hasDuration = dur > 0;

  let refreshRateSec = refreshSec;
  if (playing && hasDuration) {
    refreshRateSec = clamp(Math.ceil(dur / 1000 / segmentCount), refreshMinSec, refreshMaxSec);
  }

  // Playing or paused with duration: keep filled segments at current progress.
  // Idle / no duration: empty bar.
  let filledSegments = 0;
  if (hasDuration) {
    filledSegments = clamp(Math.floor((prog / dur) * segmentCount), 0, segmentCount);
  }

  const showProgressBar = Boolean(p.showProgressBar) && hasDuration;
  const stateLabel = playing ? 'Playing' : 'Paused';
  const progressText = `${formatMs(prog)} / ${formatMs(dur)} · ${stateLabel}`;

  const fillPercent = segmentCount > 0
    ? Math.round((filledSegments / segmentCount) * 100)
    : 0;

  return {
    refreshRateSec,
    segmentCount,
    filledSegments,
    fillPercent,
    showProgressBar,
    progressBarPx: barWidthPx,
    progressText,
  };
}

export { DEFAULT_PROFILE as EINK_DEFAULT_PROFILE };
