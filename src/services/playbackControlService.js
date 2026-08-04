import { probeSession, sendCommand } from '../lib/dacpClient.js';

const AP2_UNSUPPORTED_MS = 8000;
const IOS_BLOCKED_CHECK_MS = 2000;

const ACTION_TO_COMMAND = {
  play: 'play',
  pause: 'pause',
  toggle: 'playpause',
  next: 'nextitem',
  prev: 'previtem',
};

let controlSession = null;
let controlAvailable = false;
let controlReason = 'no_session';
let ap2Timer = null;
let iosBlockedTimer = null;
let pendingActionCheck = null;
let getPlaybackSnapshot = () => ({ isPlaying: false, title: null });

const isLinkLocal = (ip) => /^fe80:/i.test(String(ip ?? '').trim());

const isSessionComplete = (session) =>
  !!(session?.dacpId && session?.dacpPort && session?.clientIp);

const clearAp2Timer = () => {
  if (ap2Timer) {
    clearTimeout(ap2Timer);
    ap2Timer = null;
  }
};

const clearIosBlockedTimer = () => {
  if (iosBlockedTimer) {
    clearTimeout(iosBlockedTimer);
    iosBlockedTimer = null;
  }
  pendingActionCheck = null;
};

const setControlState = (available, reason) => {
  controlAvailable = available;
  controlReason = available ? null : reason;
};

const runProbe = async () => {
  if (!isSessionComplete(controlSession)) {
    setControlState(false, 'no_session');
    return;
  }

  clearAp2Timer();
  const result = await probeSession(controlSession);
  if (result.ok) {
    setControlState(true, null);
    return;
  }

  setControlState(false, 'dacp_probe_failed');
};

export const configurePlaybackControl = ({ getPlaybackState } = {}) => {
  if (typeof getPlaybackState === 'function') {
    getPlaybackSnapshot = getPlaybackState;
  }
};

export const updateControlSession = (partial) => {
  if (!partial || Object.keys(partial).length === 0) return;

  const prev = controlSession ?? {};
  const next = { ...prev, ...partial, updatedAt: new Date().toISOString() };

  if (partial.clientIp && prev.clientIp && isLinkLocal(partial.clientIp) && !isLinkLocal(prev.clientIp)) {
    next.clientIp = prev.clientIp;
  }

  controlSession = next;

  if (isSessionComplete(controlSession)) {
    void runProbe();
  } else {
    setControlState(false, 'no_session');
  }
};

export const notifyActivePlayback = () => {
  if (isSessionComplete(controlSession)) return;

  clearAp2Timer();
  ap2Timer = setTimeout(() => {
    ap2Timer = null;
    if (!isSessionComplete(controlSession)) {
      setControlState(false, 'ap2_unsupported');
    }
  }, AP2_UNSUPPORTED_MS);
};

export const clearControlSession = () => {
  controlSession = null;
  clearAp2Timer();
  clearIosBlockedTimer();
  setControlState(false, 'no_session');
};

export const getControlState = () => ({
  controlAvailable,
  controlReason,
});

const scheduleIosBlockedCheck = (action) => {
  clearIosBlockedTimer();

  const before = getPlaybackSnapshot();
  const expectPlaying =
    action === 'play' ? true : action === 'pause' ? false : null;

  if (expectPlaying === null) return;

  pendingActionCheck = { expectPlaying, beforePlaying: before.isPlaying };
  iosBlockedTimer = setTimeout(() => {
    iosBlockedTimer = null;
    const check = pendingActionCheck;
    pendingActionCheck = null;
    if (!check) return;

    const after = getPlaybackSnapshot();
    if (after.isPlaying === check.expectPlaying) return;
    if (after.isPlaying === check.beforePlaying) {
      setControlState(false, 'ios_blocked');
    }
  }, IOS_BLOCKED_CHECK_MS);
};

export const sendAction = async (action) => {
  const command = ACTION_TO_COMMAND[action];
  if (!command) {
    return { ok: false, action, reason: 'invalid_action' };
  }

  if (!isSessionComplete(controlSession)) {
    return { ok: false, action, reason: 'no_session' };
  }

  if (!controlAvailable) {
    return { ok: false, action, reason: controlReason ?? 'control_unavailable' };
  }

  const result = await sendCommand(controlSession, command);
  if (!result.ok) {
    if (result.reason === 'no_session') {
      return { ok: false, action, reason: 'no_session' };
    }
    setControlState(false, 'dacp_probe_failed');
    return { ok: false, action, reason: 'dacp_probe_failed' };
  }

  scheduleIosBlockedCheck(action);
  return { ok: true, action };
};
