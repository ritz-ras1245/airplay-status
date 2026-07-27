import { formatMs } from '../utils/formatTime.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const computeSegmentCount = (profile) =>
  clamp(
    Math.floor(profile.progressBarPx / profile.segmentMinPx),
    3,
    profile.segmentMax,
  );

export const computeFilledSegments = (playback, segmentCount) => {
  const { isPlaying, progressMs, durationMs } = playback;
  if (!isPlaying || !durationMs || durationMs <= 0) return 0;
  return clamp(Math.floor((progressMs / durationMs) * segmentCount), 0, segmentCount);
};

export const computeRefreshRateSec = (profile, playback, segmentCount, showProgressBar) => {
  const { isPlaying, durationMs } = playback;
  if (showProgressBar && isPlaying && durationMs > 0 && segmentCount > 0) {
    return clamp(
      Math.ceil(durationMs / 1000 / segmentCount),
      profile.refreshMinSec,
      profile.refreshMaxSec,
    );
  }
  return profile.refreshSec;
};

export const buildProgressText = (playback) => {
  const { progressMs, durationMs } = playback;
  if (!durationMs) return '';
  return `${formatMs(progressMs)} / ${formatMs(durationMs)}`;
};

/** @param {{ deviceId: string, profile: Record<string, unknown> }} device */
export const buildEinkViewModel = (playback, { deviceId, profile }, { showDebug = false } = {}) => {
  const showProgressBar = Boolean(profile.showProgressBar);
  const segmentCount = showProgressBar ? computeSegmentCount(profile) : 0;
  const filledSegments = showProgressBar
    ? computeFilledSegments(playback, segmentCount)
    : 0;
  const refreshRateSec = computeRefreshRateSec(
    profile,
    playback,
    segmentCount,
    showProgressBar,
  );
  const progressText = buildProgressText(playback);
  const hasTrack = Boolean(playback?.title);

  return {
    playback,
    deviceId,
    deviceLabel: profile.label,
    showProgressBar,
    segmentCount,
    filledSegments,
    refreshRateSec,
    progressText,
    hasTrack,
    showDebug,
    playingLabel: playback?.isPlaying ? 'Playing' : 'Paused',
  };
};

export const buildEinkEtagPayload = (deviceId, playback, filledSegments) =>
  [
    deviceId,
    playback?.title ?? '',
    playback?.artist ?? '',
    playback?.album ?? '',
    playback?.isPlaying ? '1' : '0',
    String(filledSegments),
  ].join('|');
