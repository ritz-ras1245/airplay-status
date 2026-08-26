/**
 * Media Status source pills + mock polling for the focused card.
 * Live card updates still come from SSE in live.js / display.js.
 * Pills are HTML forms so pin works even if this module fails to bind.
 */
const pillsEl = () => document.getElementById('source-pills');

const isLive = () => document.body.dataset.live === 'true';

const formatMs = (ms) => {
  if (!ms || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const paintPillButton = (btn, src, board) => {
  btn.dataset.sourceId = src.id;
  btn.textContent = src.label;
  btn.classList.toggle('source-pill--active', src.id === board.focusedId);
  btn.classList.toggle('source-pill--idle', !src.hasTrack);
  btn.classList.toggle('source-pill--pinned', board.pinned && src.id === board.focusedId);
};

const makePillForm = (src, board) => {
  const form = document.createElement('form');
  form.className = 'source-pill-form';
  form.method = 'post';
  form.action = '/api/sources/focus';
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'sourceId';
  input.value = src.id;
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'source-pill';
  paintPillButton(btn, src, board);
  form.append(input, btn);
  return form;
};

const renderPills = (board) => {
  const nav = pillsEl();
  if (!nav) return;
  if (!board?.sources || board.sources.length < 2) {
    nav.hidden = true;
    nav.replaceChildren();
    return;
  }
  nav.hidden = false;
  nav.dataset.pinned = board.pinned ? '1' : '0';

  const existing = [...nav.querySelectorAll('.source-pill-form')];
  if (existing.length === board.sources.length) {
    board.sources.forEach((src, i) => {
      const form = existing[i];
      const input = form.querySelector('[name="sourceId"]');
      const btn = form.querySelector('.source-pill');
      if (input) input.value = src.id;
      if (btn) paintPillButton(btn, src, board);
    });
    return;
  }

  nav.replaceChildren(...board.sources.map((src) => makePillForm(src, board)));
};

const pinSource = async (sourceId) => {
  try {
    const res = await fetch('/api/sources/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId }),
    });
    if (!res.ok) return;
    const board = await res.json();
    renderPills(board);
    if (!isLive() && board.focused) applyDashboard(board.focused);
  } catch {
    /* ignore */
  }
};

const applyDashboard = (playback) => {
  const empty = document.getElementById('empty-state');
  const card = document.getElementById('track-card');
  const header = document.getElementById('page-header');
  if (!card) return;

  const hasTrack = Boolean(playback?.title);
  if (header && isLive()) header.hidden = hasTrack;
  if (empty) empty.hidden = hasTrack;
  card.hidden = !hasTrack;
  if (!hasTrack) return;

  const title = document.getElementById('track-title');
  const artist = document.getElementById('track-artist');
  const album = document.getElementById('track-album');
  const source = document.getElementById('track-source');
  const badge = document.getElementById('status-badge');
  const art = document.getElementById('album-art');
  const artPh = document.getElementById('album-art-ph');
  const fill = document.getElementById('progress-fill');
  const cur = document.getElementById('progress-current');
  const tot = document.getElementById('progress-total');

  if (title) title.textContent = playback.title ?? '';
  if (artist) artist.textContent = playback.artist ?? '';
  if (album) album.textContent = playback.album ?? '';
  if (source) source.textContent = playback.source || playback.sourceId || '';
  if (badge) {
    badge.textContent = playback.isPlaying ? '▶ Playing' : '⏸ Paused';
    badge.classList.toggle('status-badge--paused', !playback.isPlaying);
  }
  if (art && artPh) {
    if (playback.albumArt) {
      art.src = playback.albumArt;
      art.hidden = false;
      artPh.hidden = true;
    } else {
      art.hidden = true;
      artPh.hidden = false;
    }
  }
  const pct = playback.durationMs
    ? Math.min(100, Math.round((playback.progressMs / playback.durationMs) * 100))
    : 0;
  if (fill) fill.style.width = `${pct}%`;
  if (cur) cur.textContent = formatMs(playback.progressMs);
  if (tot) tot.textContent = formatMs(playback.durationMs);

  const icon = document.querySelector('.source-info .airplay-icon');
  if (icon) {
    icon.classList.toggle('airplay-icon--hidden', playback.sourceId === 'spotify');
  }
};

const nothingPreview = () =>
  new URLSearchParams(window.location.search).get('state') === 'nothing';

const poll = async () => {
  if (nothingPreview()) return;
  try {
    const res = await fetch('/api/sources');
    if (!res.ok) return;
    const board = await res.json();
    renderPills(board);
    if (!isLive() && board.focused) applyDashboard(board.focused);
  } catch {
    /* ignore */
  }
};

poll();
setInterval(poll, 1000);

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form.source-pill-form');
  if (!form) return;
  event.preventDefault();
  const sourceId = new FormData(form).get('sourceId');
  if (sourceId) pinSource(String(sourceId));
});
