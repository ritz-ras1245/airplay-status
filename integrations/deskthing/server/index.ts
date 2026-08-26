/**
 * DeskThing backend for the airplay-status always-on client (P8).
 *
 * Responsibility split (per spec OD1 = A):
 *   - This server polls airplay-status `GET /api/status` (P0), runs the shared
 *     always-on state machine, and pushes { playback, state } to the client.
 *   - The client (src/) renders now-playing / idle / resume and reports focus
 *     and nudge dismissal back here.
 *
 * "Screen off" (OD2) and "resume nudge" (OD3) are applied by the client via the
 * DeskThing device APIs from the pushed state; the rules live in one place
 * (../shared/alwaysOnState.js) so P7/P8/P9 stay consistent.
 *
 * NOTE: authored against the documented DeskThing SDK shape; verify method
 * names against the @deskthing/server version you pin before shipping.
 */
import { DeskThing } from '@deskthing/server';
import { ServerEvent } from '@deskthing/types';
// @ts-expect-error — shared pure JS module (no types package needed)
import { initialState, reduce, shouldKeepScreenOn } from '../shared/alwaysOnState.js';

type Settings = {
  airplayStatusUrl: string;
  fallbackUrl: string | null;
  idleGraceSec: number;
  pollSec: number;
};

const DEFAULTS: Settings = {
  airplayStatusUrl: 'http://airplay-status.home.arpa:3003',
  fallbackUrl: null,
  idleGraceSec: 45,
  pollSec: 3,
};

let settings: Settings = { ...DEFAULTS };
let state = initialState();
let focused = true; // Car Thing typically runs one app; refined by client focus events
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastMode = 'idle';

const pushToClient = (playback: unknown) => {
  DeskThing.send({
    type: 'display',
    payload: { playback, state, keepScreenOn: shouldKeepScreenOn(state) },
  });
};

const clearIdleTimer = () => {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
};

const scheduleIdle = () => {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    state = reduce(state, { type: 'idleGraceElapsed', focused });
    pushToClient(lastPlayback);
  }, settings.idleGraceSec * 1000);
};

let lastPlayback: unknown = null;

const fetchStatus = async (): Promise<unknown | null> => {
  const urls = [settings.airplayStatusUrl, settings.fallbackUrl].filter(Boolean) as string[];
  for (const base of urls) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/api/status`, {
        signal: AbortSignal.timeout(settings.pollSec * 1000),
      });
      if (res.ok) return await res.json();
    } catch {
      /* try next url */
    }
  }
  return null;
};

const tick = async () => {
  const playback = await fetchStatus();
  lastPlayback = playback;
  state = reduce(state, { type: 'playback', playback });

  if (state.mode === 'idle') {
    if (lastMode !== 'idle') scheduleIdle(); // just went idle → start grace
  } else {
    clearIdleTimer();
  }
  lastMode = state.mode;

  pushToClient(playback);
};

const applySettings = (raw: Record<string, { value?: unknown }> | undefined) => {
  if (!raw) return;
  settings = {
    airplayStatusUrl: String(raw.airplayStatusUrl?.value ?? DEFAULTS.airplayStatusUrl),
    fallbackUrl: raw.fallbackUrl?.value ? String(raw.fallbackUrl.value) : null,
    idleGraceSec: Number(raw.idleGraceSec?.value ?? DEFAULTS.idleGraceSec),
    pollSec: Number(raw.pollSec?.value ?? DEFAULTS.pollSec),
  };
};

const start = async () => {
  DeskThing.getSettings?.().then(applySettings).catch(() => {});

  // Client → server messages (focus + nudge dismissal).
  DeskThing.on('focus', (data: { payload?: boolean }) => {
    focused = Boolean(data?.payload);
    if (!focused) state = reduce(state, { type: 'focusLost' });
  });
  DeskThing.on('dismissNudge', () => {
    state = reduce(state, { type: 'dismissNudge' });
    pushToClient(lastPlayback);
  });

  if (pollTimer) clearInterval(pollTimer);
  await tick();
  pollTimer = setInterval(tick, settings.pollSec * 1000);
};

DeskThing.on(ServerEvent.START, start);
DeskThing.on(ServerEvent.SETTINGS, (data: { payload?: Record<string, { value?: unknown }> }) =>
  applySettings(data?.payload),
);
DeskThing.on(ServerEvent.STOP, () => {
  clearIdleTimer();
  if (pollTimer) clearInterval(pollTimer);
});

export { start };
