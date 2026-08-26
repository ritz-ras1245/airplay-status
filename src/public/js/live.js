const formatMs = (ms) => {
  if (!ms || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  transport: document.getElementById('transport'),
  transportHint: document.getElementById('transport-hint'),
  transportBtns: document.querySelectorAll('.transport-btn[data-action]'),
};

let snapshot = null;
let lastArtUrl = null;
let progressAnchor = { ms: 0, at: 0 };
let frozenProgressMs = 0;
let emptyTimer = null;

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

const CONTROL_COPY = {
  no_session: 'Select AirPlay Status as an output to enable transport controls.',
  dacp_probe_failed: 'Remote control is unavailable for this session (DACP probe failed).',
  ios_blocked: 'Your iPhone may ignore remote commands on iOS 17.4+ even when buttons send.',
  ap2_unsupported:
    'This session looks like AirPlay 2. Native iPhone/iPad Now Playing uses MRP, which this receiver does not implement.',
  control_unavailable: 'Transport controls are not available right now.',
};

const controlMessage = (reason) => CONTROL_COPY[reason] || CONTROL_COPY.control_unavailable;

const setTransport = (playback) => {
  if (!els.transport) return;
  const hasTrack = !!playback.title;
  els.transport.hidden = !hasTrack;
  const enabled = Boolean(playback.controlAvailable);
  els.transportBtns.forEach((btn) => {
    btn.disabled = !enabled;
    if (btn.dataset.action === 'toggle') {
      btn.textContent = playback.isPlaying ? '⏸' : '▶';
    }
  });
  if (els.transportHint) {
    els.transportHint.textContent = enabled ? '' : controlMessage(playback.controlReason);
  }
};

const setBadge = (playing) => {
  els.badge.textContent = playing ? '▶ Playing' : '⏸ Paused';
  els.badge.classList.toggle('status-badge--paused', !playing);
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
    setTransport({ title: null, controlAvailable: false, controlReason: 'no_session' });
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
  setTransport(playback);

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

const sendControl = async (action, btn) => {
  if (!snapshot?.controlAvailable) return;
  btn?.classList.add('transport-btn--busy');
  try {
    const res = await fetch(`/api/control/${action}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = await res.json().catch(() => ({ ok: false, reason: 'control_unavailable' }));
    if (!body.ok && els.transportHint) {
      els.transportHint.textContent = controlMessage(body.reason);
    }
  } catch {
    if (els.transportHint) {
      els.transportHint.textContent = controlMessage('dacp_probe_failed');
    }
  } finally {
    btn?.classList.remove('transport-btn--busy');
  }
};

els.transportBtns.forEach((btn) => {
  btn.addEventListener('click', () => sendControl(btn.dataset.action, btn));
});

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
