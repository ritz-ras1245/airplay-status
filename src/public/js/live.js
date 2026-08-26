const formatMs = (ms) => {
  if (!ms || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const CONTROL_REASONS = {
  no_session: 'Remote control requires an active AirPlay session with AirPlay Status selected.',
  dacp_probe_failed: 'Remote control is unavailable for this session.',
  ios_blocked:
    'This device may not respond to remote control (known iOS 17.4+ limitation). Use the phone directly.',
  ap2_unsupported: 'AirPlay 2-only senders do not support remote control.',
  control_unavailable: 'Remote control is unavailable.',
};

const els = {
  header: document.getElementById('page-header'),
  empty: document.getElementById('empty-state'),
  card: document.getElementById('track-card'),
  artImg: document.getElementById('album-art'),
  artPh: document.getElementById('album-art-ph'),
  title: document.getElementById('track-title'),
  artist: document.getElementById('track-artist'),
  album: document.getElementById('track-album'),
  progress: document.getElementById('progress-fill'),
  timeCurrent: document.getElementById('progress-current'),
  timeTotal: document.getElementById('progress-total'),
  badge: document.getElementById('status-badge'),
  source: document.getElementById('track-source'),
  transport: document.getElementById('transport-controls'),
  btnPrev: document.getElementById('btn-prev'),
  btnToggle: document.getElementById('btn-toggle'),
  btnNext: document.getElementById('btn-next'),
  controlHint: document.getElementById('control-hint'),
  controlToast: document.getElementById('control-toast'),
};

let snapshot = null;
let lastArtUrl = null;
let progressAnchor = { ms: 0, at: 0 };
let frozenProgressMs = 0;
let emptyTimer = null;
let controlBusy = false;
let toastTimer = null;

const setVisible = (hasTrack) => {
  if (els.header) els.header.hidden = hasTrack;

  if (hasTrack) {
    if (emptyTimer) {
      clearTimeout(emptyTimer);
      emptyTimer = null;
    }
    els.empty.hidden = true;
    els.card.hidden = false;
    return;
  }

  if (emptyTimer) return;
  emptyTimer = setTimeout(() => {
    emptyTimer = null;
    els.empty.hidden = false;
    els.card.hidden = true;
  }, 600);
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
  els.badge.classList.toggle('status-badge--paused', !playing);
};

const showToast = (message) => {
  if (!els.controlToast) return;
  els.controlToast.textContent = message;
  els.controlToast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.controlToast.hidden = true;
    toastTimer = null;
  }, 4000);
};

const setTransportState = (playback) => {
  if (!els.transport) return;

  const hasTrack = !!playback.title;
  els.transport.hidden = !hasTrack;

  if (!hasTrack) {
    if (els.controlHint) els.controlHint.hidden = true;
    return;
  }

  const available = playback.controlAvailable === true;
  const reason = playback.controlReason;
  const disabled = !available || controlBusy;

  for (const btn of [els.btnPrev, els.btnToggle, els.btnNext]) {
    if (!btn) continue;
    btn.disabled = disabled;
  }

  if (els.btnToggle) {
    els.btnToggle.textContent = playback.isPlaying ? '⏸' : '▶';
    els.btnToggle.setAttribute(
      'aria-label',
      playback.isPlaying ? 'Pause' : 'Play',
    );
    els.btnToggle.title = playback.isPlaying ? 'Pause' : 'Play';
  }

  const hintText = available ? '' : CONTROL_REASONS[reason] ?? CONTROL_REASONS.control_unavailable;
  if (els.controlHint) {
    els.controlHint.hidden = available;
    els.controlHint.textContent = hintText;
  }

  for (const btn of [els.btnPrev, els.btnToggle, els.btnNext]) {
    if (!btn) continue;
    btn.title = available ? btn.getAttribute('aria-label') : hintText;
  }
};

const sendControl = async (action) => {
  if (controlBusy || !snapshot?.controlAvailable) return;

  controlBusy = true;
  setTransportState(snapshot);

  try {
    const res = await fetch(`/api/control/${action}`, { method: 'POST' });
    const body = await res.json();

    if (!body.ok) {
      const message =
        CONTROL_REASONS[body.reason] ??
        'Remote control command failed.';
      showToast(message);
    }
  } catch (err) {
    console.error('control request failed', err);
    showToast('Remote control request failed.');
  } finally {
    controlBusy = false;
    if (snapshot) setTransportState(snapshot);
  }
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
    els.artImg.removeAttribute('src');
    els.artImg.hidden = true;
    els.artPh.hidden = false;
    if (els.title.textContent) els.title.textContent = '';
    if (els.artist.textContent) els.artist.textContent = '';
    if (els.album.textContent) els.album.textContent = '';
    updateProgress(0, 0);
    setTransportState(playback);
    return;
  }

  const hasArt = !!playback.albumArt;

  if (playback.albumArt) {
    if (lastArtUrl !== playback.albumArt) {
      els.artImg.src = playback.albumArt;
      lastArtUrl = playback.albumArt;
    }
  } else {
    lastArtUrl = null;
    els.artImg.removeAttribute('src');
  }

  els.artImg.hidden = !hasArt;
  els.artPh.hidden = hasArt;

  if (els.title.textContent !== (playback.title ?? '')) {
    els.title.textContent = playback.title ?? '';
  }
  if (els.artist.textContent !== (playback.artist ?? '')) {
    els.artist.textContent = playback.artist ?? '';
  }
  if (els.album.textContent !== (playback.album ?? '')) {
    els.album.textContent = playback.album ?? '';
  }

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
  setTransportState(playback);

  const sourceLabel = playback.source || 'AirPlay';
  if (els.source.textContent !== sourceLabel) {
    els.source.textContent = sourceLabel;
  }
};

const tickProgress = () => {
  if (!snapshot?.title || !snapshot.isPlaying || !snapshot.durationMs) return;

  const elapsed = Date.now() - progressAnchor.at;
  const progressMs = Math.min(snapshot.durationMs, progressAnchor.ms + elapsed);
  updateProgress(progressMs, snapshot.durationMs);
};

if (els.btnPrev) {
  els.btnPrev.addEventListener('click', () => sendControl('prev'));
}
if (els.btnToggle) {
  els.btnToggle.addEventListener('click', () => sendControl('toggle'));
}
if (els.btnNext) {
  els.btnNext.addEventListener('click', () => sendControl('next'));
}

const source = new EventSource('/api/events');
source.onmessage = (event) => {
  try {
    applySnapshot(JSON.parse(event.data));
  } catch (err) {
    console.error('bad event payload', err);
  }
};
source.onerror = () => {
  console.warn('SSE disconnected, retrying…');
};

setInterval(tickProgress, 1000);
