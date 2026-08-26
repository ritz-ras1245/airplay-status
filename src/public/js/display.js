import {
  classifyPlayback,
  shouldHoldWakeLock,
  shouldNudgeResume,
} from './displayState.js';

const IDLE_GRACE_MS = 8000;

const formatMs = (ms) => {
  if (!ms || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const els = {
  body: document.body,
  bg: document.getElementById('kiosk-bg'),
  idle: document.getElementById('kiosk-idle'),
  now: document.getElementById('kiosk-now'),
  art: document.getElementById('kiosk-art'),
  artPh: document.getElementById('kiosk-art-ph'),
  title: document.getElementById('kiosk-title'),
  artist: document.getElementById('kiosk-artist'),
  album: document.getElementById('kiosk-album'),
  fill: document.getElementById('kiosk-progress-fill'),
  cur: document.getElementById('kiosk-cur'),
  tot: document.getElementById('kiosk-tot'),
  badge: document.getElementById('kiosk-badge'),
  source: document.getElementById('kiosk-source'),
  resume: document.getElementById('kiosk-resume'),
};

let snapshot = null;
let lastArtUrl = null;
let mode = 'idle';
let progressAnchor = { ms: 0, at: 0 };
let frozenProgressMs = 0;

let idleTimer = null;
let screenDimmed = false;
let focusBeforeIdle = false;
let wakeLock = null;

/* ---- Screen Wake Lock ---- */
const acquireWakeLock = async () => {
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
};

const releaseWakeLock = async () => {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    /* already released */
  }
  wakeLock = null;
};

const syncWakeLock = () => {
  if (shouldHoldWakeLock(mode) && !screenDimmed) {
    acquireWakeLock();
  } else {
    releaseWakeLock();
  }
};

/* ---- Idle screen-off grace ---- */
const dimScreen = () => {
  screenDimmed = true;
  // Capture whether this client was the active/foreground session as it dimmed.
  focusBeforeIdle = document.visibilityState === 'visible' && document.hasFocus();
  els.body.classList.add('kiosk--dimmed');
  releaseWakeLock();
};

const clearIdleTimer = () => {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
};

const wakeScreen = () => {
  screenDimmed = false;
  els.body.classList.remove('kiosk--dimmed');
  syncWakeLock();
};

const scheduleIdle = () => {
  if (idleTimer || screenDimmed) return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    dimScreen();
  }, IDLE_GRACE_MS);
};

/* ---- Resume nudge ---- */
const showResumeNudge = () => {
  els.resume.hidden = false;
};

const dismissResume = () => {
  els.resume.hidden = true;
  wakeScreen();
};

els.resume?.addEventListener('click', dismissResume);

/* ---- Rendering ---- */
const setSections = (isIdle) => {
  els.idle.hidden = !isIdle;
  els.now.hidden = isIdle;
};

const updateProgress = (progressMs, durationMs) => {
  const pct = durationMs ? Math.min(100, Math.round((progressMs / durationMs) * 100)) : 0;
  els.fill.style.width = `${pct}%`;
  els.cur.textContent = formatMs(progressMs);
  els.tot.textContent = formatMs(durationMs);
};

const updateArtwork = (playback) => {
  const hasArt = !!playback.albumArt;
  if (hasArt) {
    if (lastArtUrl !== playback.albumArt) {
      els.art.src = playback.albumArt;
      els.bg.style.backgroundImage = `url('${playback.albumArt}')`;
      lastArtUrl = playback.albumArt;
    }
  } else {
    lastArtUrl = null;
    els.art.removeAttribute('src');
    els.bg.style.backgroundImage = '';
  }
  els.art.hidden = !hasArt;
  els.artPh.hidden = hasArt;
};

const applySnapshot = (playback) => {
  const prevMode = mode;
  snapshot = playback;
  mode = classifyPlayback(playback);

  const startedPlaying = prevMode !== 'playing' && mode === 'playing';

  // Resume nudge: playback returned while the screen was dimmed off.
  if (startedPlaying && screenDimmed) {
    if (shouldNudgeResume({ focusBeforeIdle, screenDimmed, startedPlaying })) {
      showResumeNudge();
    } else {
      wakeScreen();
    }
  }

  if (mode === 'idle') {
    setSections(true);
    lastArtUrl = null;
    frozenProgressMs = 0;
    progressAnchor = { ms: 0, at: 0 };
    els.bg.style.backgroundImage = '';
    scheduleIdle();
    syncWakeLock();
    return;
  }

  // Active again: cancel any pending dim.
  clearIdleTimer();
  if (screenDimmed && els.resume.hidden) wakeScreen();

  setSections(false);
  updateArtwork(playback);

  if (els.title.textContent !== (playback.title ?? '')) els.title.textContent = playback.title ?? '';
  if (els.artist.textContent !== (playback.artist ?? '')) els.artist.textContent = playback.artist ?? '';
  if (els.album.textContent !== (playback.album ?? '')) els.album.textContent = playback.album ?? '';

  if (playback.isPlaying) {
    progressAnchor = { ms: playback.progressMs ?? 0, at: Date.now() };
    frozenProgressMs = progressAnchor.ms;
    updateProgress(progressAnchor.ms, playback.durationMs ?? 0);
  } else {
    updateProgress(frozenProgressMs || (playback.progressMs ?? 0), playback.durationMs ?? 0);
  }

  els.badge.textContent = playback.isPlaying ? '▶ Playing' : '⏸ Paused';
  els.badge.classList.toggle('kiosk-badge--paused', !playback.isPlaying);
  els.source.textContent = playback.source || 'AirPlay';

  syncWakeLock();
};

const tickProgress = () => {
  if (!snapshot?.title || !snapshot.isPlaying || !snapshot.durationMs) return;
  const elapsed = Date.now() - progressAnchor.at;
  const progressMs = Math.min(snapshot.durationMs, progressAnchor.ms + elapsed);
  updateProgress(progressMs, snapshot.durationMs);
};

/* ---- Focus tracking (leaving the app clears focus-before-idle) ---- */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    focusBeforeIdle = false;
  } else {
    // Returned to the app: re-hold wake lock if we should.
    syncWakeLock();
  }
});
window.addEventListener('blur', () => {
  if (!screenDimmed) focusBeforeIdle = false;
});

/* ---- SSE ---- */
const source = new EventSource('/api/events');
source.onmessage = (event) => {
  try {
    applySnapshot(JSON.parse(event.data));
  } catch (err) {
    console.error('bad event payload', err);
  }
};
source.onerror = () => console.warn('SSE disconnected, retrying…');

setInterval(tickProgress, 1000);
