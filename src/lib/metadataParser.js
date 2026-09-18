/**
 * Parse metadata events into playback state updates.
 */

export const createEmptyPlaybackState = () => ({
  isPlaying: false,
  connected: false,
  streamOpen: false,
  title: null,
  artist: null,
  album: null,
  albumArt: null,
  progressMs: 0,
  durationMs: 0,
  /** Wall-clock ms when progressMs was last set from the pipe (for eInk/server extrapolation). */
  progressAnchorAt: null,
  clientName: null,
  clientModel: null,
  senderApp: null,
  dacpId: null,
  dacpPort: null,
  clientIp: null,
  activeRemote: null,
  updatedAt: null,
});

/** Extrapolate progress while playing from last pipe sample. */
export const effectiveProgressMs = (state, now = Date.now()) => {
  const base = Math.max(0, Number(state.progressMs) || 0);
  const duration = Math.max(0, Number(state.durationMs) || 0);
  if (!state.isPlaying || !state.progressAnchorAt) {
    return duration > 0 ? Math.min(base, duration) : base;
  }
  const elapsed = Math.max(0, now - state.progressAnchorAt);
  const extrapolated = base + elapsed;
  return duration > 0 ? Math.min(extrapolated, duration) : extrapolated;
};

/** @deprecated text-line parser kept for demo script */
export const parseMetadataLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const patterns = [
    { field: 'title', regex: /^Title: "(.*)"\.$/ },
    { field: 'artist', regex: /^Artist: "(.*)"\.$/ },
    { field: 'album', regex: /^Album Name: "(.*)"\.$/ },
    { field: 'durationMs', regex: /^Track length: (\d+) milliseconds\.$/, numeric: true },
    { field: 'clientName', regex: /^The name of the AirPlay client is "(.*)"\.$/ },
    { field: 'clientModel', regex: /^The model of the AirPlay client is "(.*)"\.$/ },
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      return {
        type: 'field',
        field: pattern.field,
        value: pattern.numeric ? Number(match[1]) : match[1],
      };
    }
  }

  const events = [
    { event: 'play', regex: /^Play Session Begin\.$/ },
    { event: 'stop', regex: /^Play Session End\.$/ },
    { event: 'pause', regex: /^Pause\./ },
    { event: 'resume', regex: /^Resume\./ },
    { event: 'active_begin', regex: /^Enter Active State\.$/ },
    { event: 'active_end', regex: /^Exit Active State\.$/ },
    { event: 'disconnect', regex: /^The AirPlay client at .* has disconnected/ },
    {
      event: 'progress',
      regex: /^Progress String "(\d+)\/(\d+)\/(\d+)"\.$/,
      progress: true,
    },
  ];

  for (const pattern of events) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;

    if (pattern.progress) {
      const start = Number(match[1]);
      const current = Number(match[2]);
      const end = Number(match[3]);
      const rtpToMs = (f) => Math.max(0, Math.round((f / 44100) * 1000));
      return {
        type: 'field',
        field: 'progress',
        value: { progressMs: rtpToMs(current - start), durationMs: rtpToMs(end - start) },
      };
    }

    return { type: 'event', event: pattern.event };
  }

  return null;
};

export const formatSource = (state) => {
  if (state.clientName) return state.clientName;
  if (state.senderApp) return state.senderApp;
  if (state.clientModel) return state.clientModel;
  return 'AirPlay';
};

export const toPublicState = (state, control = {}) => ({
  isPlaying: state.isPlaying,
  connected: state.connected,
  title: state.title,
  artist: state.artist,
  album: state.album,
  albumArt: state.albumArt,
  progressMs: effectiveProgressMs(state),
  durationMs: state.durationMs,
  source: formatSource(state),
  updatedAt: state.updatedAt,
  controlAvailable: Boolean(control.controlAvailable),
  controlReason: control.controlAvailable ? null : (control.controlReason ?? 'no_session'),
});

export const applyMetadataUpdate = (state, update) => {
  if (!update) return state;

  const next = { ...state, updatedAt: new Date().toISOString() };
  const now = Date.now();

  if (update.type === 'field') {
    if (update.field === 'progress') {
      if (!next.isPlaying) return next;

      const { progressMs, durationMs } = update.value;
      if (Number.isFinite(progressMs) && progressMs >= 0) {
        next.progressMs = progressMs;
        next.progressAnchorAt = now;
      }
      if (Number.isFinite(durationMs) && durationMs > 0) {
        next.durationMs = durationMs;
      }
      return next;
    }

    const value = update.value;
    if (value === '' || value == null) return next;

    if (update.field === 'title') {
      if (value === next.title) return next;
      next.title = value;
      next.isPlaying = next.streamOpen;
      next.progressMs = 0;
      next.durationMs = 0;
      next.progressAnchorAt = next.isPlaying ? now : null;
      return next;
    }

    next[update.field] = value;
    return next;
  }

  switch (update.event) {
    case 'connect':
    case 'active_begin':
      next.connected = true;
      break;
    case 'play':
      next.connected = true;
      next.streamOpen = true;
      next.isPlaying = true;
      next.progressAnchorAt = now;
      break;
    case 'resume':
      if (next.connected) {
        next.streamOpen = true;
        next.isPlaying = true;
        next.progressAnchorAt = now;
      }
      break;
    case 'pause':
      next.progressMs = effectiveProgressMs(next, now);
      next.progressAnchorAt = null;
      next.isPlaying = false;
      break;
    case 'stop':
      next.progressMs = effectiveProgressMs(next, now);
      next.progressAnchorAt = null;
      next.streamOpen = false;
      next.isPlaying = false;
      break;
    case 'active_end':
    case 'disconnect':
      return createEmptyPlaybackState();
    case 'artwork':
      if (update.albumArt) {
        next.albumArt = update.albumArt;
      }
      break;
    default:
      break;
  }

  return next;
};
