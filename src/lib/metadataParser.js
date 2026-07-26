/**
 * Parse a single line of shairport-sync-metadata-reader stdout into an event.
 * Returns null if the line is not recognized.
 */
const LINE_PATTERNS = [
  { field: 'title', regex: /^Title: "(.*)"\.$/ },
  { field: 'artist', regex: /^Artist: "(.*)"\.$/ },
  { field: 'album', regex: /^Album Name: "(.*)"\.$/ },
  { field: 'durationMs', regex: /^Track length: (\d+) milliseconds\.$/, numeric: true },
  { field: 'genre', regex: /^Genre: "(.*)"\.$/ },
  { field: 'clientName', regex: /^The name of the AirPlay client is "(.*)"\.$/ },
];

const EVENT_PATTERNS = [
  { event: 'play', regex: /^Play Session Begin\.$/ },
  { event: 'stop', regex: /^Play Session End\.$/ },
  { event: 'pause', regex: /^Pause\.( \(AirPlay 2 only\.\))?$/ },
  { event: 'resume', regex: /^Resume\.( \(AirPlay 2 only\.\))?$/ },
  { event: 'artwork', regex: /^Picture received, length (\d+) bytes\.$/, bytes: true },
  { event: 'clientConnect', regex: /^The AirPlay client at "(.*)" has connected to this player\.$/ },
  { event: 'clientDisconnect', regex: /^The AirPlay client at "(.*)" has disconnected from this player\./ },
];

export const createEmptyPlaybackState = () => ({
  isPlaying: false,
  title: null,
  artist: null,
  album: null,
  albumArt: null,
  progressMs: 0,
  durationMs: 0,
  source: null,
  updatedAt: null,
});

export const parseMetadataLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  for (const pattern of LINE_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;

    return {
      type: 'field',
      field: pattern.field,
      value: pattern.numeric ? Number(match[1]) : match[1],
    };
  }

  for (const pattern of EVENT_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;

    const payload = pattern.bytes
      ? { length: Number(match[1]) }
      : match[1]
        ? { client: match[1] }
        : {};

    return { type: 'event', event: pattern.event, ...payload };
  }

  return null;
};

export const applyMetadataUpdate = (state, update) => {
  const next = { ...state, updatedAt: new Date().toISOString() };

  if (update.type === 'field') {
    next[update.field] = update.value;
    if (update.field === 'clientName') {
      next.source = update.value;
    }
    if (['title', 'artist', 'album'].includes(update.field)) {
      next.isPlaying = true;
    }
    return next;
  }

  switch (update.event) {
    case 'play':
    case 'resume':
      next.isPlaying = true;
      break;
    case 'pause':
      next.isPlaying = false;
      break;
    case 'stop':
    case 'clientDisconnect':
      return createEmptyPlaybackState();
    case 'clientConnect':
      next.source = update.client ?? next.source;
      break;
    default:
      break;
  }

  return next;
};
