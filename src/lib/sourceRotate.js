/**
 * Pure helpers for the Media Status one-by-one source board.
 * See specs/p11-media-status-sources.md.
 */

export const PRODUCT_NAME = 'Media Status';

export const SOURCE_DEFS = [
  { id: 'airplay', label: 'AirPlay' },
  { id: 'spotify', label: 'Spotify' },
];

export const DEFAULT_ROTATE_MS = 8000;
export const DEFAULT_PIN_MS = 30_000;

export const sourceLabel = (id) =>
  SOURCE_DEFS.find((s) => s.id === id)?.label || id;

export const hasTrack = (playback) => Boolean(playback?.title);

export const visibleSourceIds = (sourcesById, enabledIds) =>
  enabledIds.filter((id) => hasTrack(sourcesById[id]));

export const nextFocusId = (visibleIds, currentId) => {
  if (!visibleIds.length) return null;
  if (visibleIds.length === 1) return visibleIds[0];
  const i = visibleIds.indexOf(currentId);
  if (i < 0) return visibleIds[0];
  return visibleIds[(i + 1) % visibleIds.length];
};

/**
 * Choose which source should be on the glass right now.
 * Pin wins while it is still valid; otherwise keep current if still visible.
 */
export const resolveFocus = ({
  visibleIds,
  currentId,
  pinnedId,
  nowMs,
  pinUntilMs,
}) => {
  const pinActive =
    Boolean(pinnedId) &&
    Number.isFinite(pinUntilMs) &&
    nowMs < pinUntilMs &&
    visibleIds.includes(pinnedId);
  if (pinActive) return pinnedId;
  if (visibleIds.includes(currentId)) return currentId;
  return visibleIds[0] ?? null;
};

export const withSourceId = (playback, sourceId) => {
  if (!playback) return playback;
  return {
    ...playback,
    sourceId,
    source: playback.source || sourceLabel(sourceId),
  };
};

export const emptyPlayback = (sourceId) => ({
  isPlaying: false,
  title: null,
  artist: null,
  album: null,
  albumArt: null,
  progressMs: 0,
  durationMs: 0,
  source: sourceLabel(sourceId),
  sourceId,
  updatedAt: null,
});
