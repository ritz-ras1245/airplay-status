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

const markTestStep = async (label, button) => {
  try {
    const res = await fetch('/api/debug/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) throw new Error('mark failed');
    if (button) {
      button.classList.add('debug-btn--sent');
      setTimeout(() => button.classList.remove('debug-btn--sent'), 1200);
    }
  } catch (err) {
    console.error('test mark failed', err);
  }
};

for (const button of document.querySelectorAll('.debug-btn[data-mark]')) {
  button.addEventListener('click', () => {
    markTestStep(button.dataset.mark, button);
  });
}
