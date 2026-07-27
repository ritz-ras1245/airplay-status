const formatMs = (ms) => {
  if (!ms || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const params = new URLSearchParams(window.location.search);
const kioskMode = params.get('kiosk') === '1';

const els = {
  empty: document.getElementById('echo-empty'),
  playing: document.getElementById('echo-playing'),
  art: document.getElementById('echo-art'),
  artPh: document.getElementById('echo-art-ph'),
  title: document.getElementById('echo-title'),
  artist: document.getElementById('echo-artist'),
  album: document.getElementById('echo-album'),
  progress: document.getElementById('echo-progress-fill'),
  timeCurrent: document.getElementById('echo-time-current'),
  timeTotal: document.getElementById('echo-time-total'),
  badge: document.getElementById('echo-badge'),
  source: document.getElementById('echo-source'),
};

let snapshot = null;
let lastArtUrl = null;
let progressAnchor = { ms: 0, at: 0 };
let frozenProgressMs = 0;
let pollTimer = null;
let sseConnected = false;

const setVisible = (hasTrack) => {
  els.empty.hidden = hasTrack;
  els.playing.hidden = !hasTrack;
};

const updateProgress = (progressMs, durationMs) => {
  const pct = durationMs
    ? Math.min(100, Math.round((progressMs / durationMs) * 100))
    : 0;
  els.progress.style.width = `${pct}%`;
  els.timeCurrent.textContent = formatMs(progressMs);
  els.timeTotal.textContent = formatMs(durationMs);
};

const setBadge = (playing) => {
  els.badge.textContent = playing ? '▶ Playing' : '⏸ Paused';
  els.badge.classList.toggle('echo-badge--paused', !playing);
};

const applySnapshot = (playback) => {
  const wasPlaying = snapshot?.isPlaying ?? false;
  snapshot = playback;

  const hasTrack = !!playback.title;
  setVisible(hasTrack);
  if (!hasTrack) {
    lastArtUrl = null;
    frozenProgressMs = 0;
    progressAnchor = { ms: 0, at: 0 };
    els.art.removeAttribute('src');
    els.art.hidden = true;
    els.artPh.hidden = false;
    els.title.textContent = '';
    els.artist.textContent = '';
    els.album.textContent = '';
    updateProgress(0, 0);
    return;
  }

  const hasArt = !!playback.albumArt;

  if (playback.albumArt) {
    if (lastArtUrl !== playback.albumArt) {
      els.art.src = playback.albumArt;
      lastArtUrl = playback.albumArt;
    }
  } else {
    lastArtUrl = null;
    els.art.removeAttribute('src');
  }

  els.art.hidden = !hasArt;
  els.artPh.hidden = hasArt;

  els.title.textContent = playback.title ?? '';
  els.artist.textContent = playback.artist ?? '';
  els.album.textContent = playback.album ?? '';

  if (playback.isPlaying) {
    progressAnchor = { ms: playback.progressMs ?? 0, at: Date.now() };
    frozenProgressMs = progressAnchor.ms;
    updateProgress(progressAnchor.ms, playback.durationMs ?? 0);
  } else if (wasPlaying && !playback.isPlaying) {
    const elapsed = Date.now() - progressAnchor.at;
    frozenProgressMs = Math.min(
      playback.durationMs ?? Infinity,
      progressAnchor.ms + elapsed,
    );
    updateProgress(frozenProgressMs, playback.durationMs ?? 0);
  } else {
    updateProgress(frozenProgressMs, playback.durationMs ?? 0);
  }

  setBadge(playback.isPlaying);
  els.source.textContent = playback.source || 'AirPlay';
};

const tickProgress = () => {
  if (!snapshot?.title || !snapshot.isPlaying || !snapshot.durationMs) return;

  const elapsed = Date.now() - progressAnchor.at;
  const progressMs = Math.min(snapshot.durationMs, progressAnchor.ms + elapsed);
  updateProgress(progressMs, snapshot.durationMs);
};

const startPolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    if (sseConnected) return;
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      applySnapshot(await res.json());
    } catch {
      // ignore poll errors
    }
  }, 5000);
};

const connectSse = () => {
  const source = new EventSource('/api/events');

  source.onopen = () => {
    sseConnected = true;
  };

  source.onmessage = (event) => {
    try {
      applySnapshot(JSON.parse(event.data));
    } catch (err) {
      console.error('[echo] bad event payload', err);
    }
  };

  source.onerror = () => {
    sseConnected = false;
    startPolling();
  };
};

const keepSilkOpen = () => {
  const noop = () => {};
  const events = ['click', 'touchstart', 'mousemove', 'keydown', 'scroll'];
  events.forEach((name) => {
    document.addEventListener(name, noop, { passive: true });
  });

  setInterval(() => {
    window.scrollBy(0, 0);
  }, 30000);
};

connectSse();
startPolling();
setInterval(tickProgress, 1000);

if (kioskMode) {
  keepSilkOpen();
}
