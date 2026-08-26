import { probeDacpSession, sendDacpCommand } from '../lib/dacpClient.js';

const AP2_GRACE_MS = 2500;

let session = null;
let controlAvailable = false;
let controlReason = 'no_session';
let ap2Timer = null;
let probeInFlight = false;
let onControlChange = () => {};

export const setControlChangeListener = (fn) => {
  onControlChange = typeof fn === 'function' ? fn : () => {};
};

const emitControlChange = () => {
  onControlChange();
};

const setUnavailable = (reason) => {
  const changed = controlAvailable !== false || controlReason !== reason || session !== null;
  controlAvailable = false;
  controlReason = reason;
  session = null;
  if (changed) emitControlChange();
};

export const getControlPublic = () => ({
  controlAvailable,
  controlReason: controlAvailable ? null : controlReason,
});

export const getControlSession = () => session;

export const resetControlForTests = () => {
  if (ap2Timer) clearTimeout(ap2Timer);
  ap2Timer = null;
  probeInFlight = false;
  setUnavailable('no_session');
};

const sessionComplete = (fields) =>
  Boolean(fields?.dacpId && fields?.dacpPort && fields?.clientIp);

export const noteInternalPlayback = (internal) => {
  if (!internal?.connected) {
    if (ap2Timer) clearTimeout(ap2Timer);
    ap2Timer = null;
    setUnavailable('no_session');
    return;
  }

  const fields = {
    dacpId: internal.dacpId || null,
    dacpPort: internal.dacpPort || null,
    clientIp: internal.clientIp || null,
    activeRemote: internal.activeRemote || internal.dacpId || null,
  };

  if (sessionComplete(fields)) {
    if (ap2Timer) clearTimeout(ap2Timer);
    ap2Timer = null;
    const same =
      session &&
      session.dacpId === fields.dacpId &&
      session.dacpPort === fields.dacpPort &&
      session.clientIp === fields.clientIp;
    session = fields;
    if (!same && !probeInFlight) {
      probeSession(fields);
    }
    return;
  }

  if (internal.title) {
    if (!ap2Timer) {
      ap2Timer = setTimeout(() => {
        ap2Timer = null;
        if (!sessionComplete(session) && !sessionComplete(fields)) {
          controlAvailable = false;
          controlReason = 'ap2_unsupported';
          session = null;
          emitControlChange();
        }
      }, AP2_GRACE_MS);
    }
    return;
  }

  controlAvailable = false;
  controlReason = 'no_session';
};

const probeSession = async (fields) => {
  probeInFlight = true;
  try {
    const skip = process.env.DACP_SKIP_PROBE === '1';
    if (skip) {
      const changed = !controlAvailable;
      controlAvailable = true;
      controlReason = null;
      if (changed) emitControlChange();
      return;
    }
    const result = await probeDacpSession(fields);
    if (result.ok) {
      const changed = !controlAvailable;
      controlAvailable = true;
      controlReason = null;
      if (changed) emitControlChange();
      return;
    }
    const changed = controlAvailable || controlReason !== 'dacp_probe_failed';
    controlAvailable = false;
    controlReason = 'dacp_probe_failed';
    if (changed) emitControlChange();
  } finally {
    probeInFlight = false;
  }
};

export const sendControlAction = async (action) => {
  if (!ACTION_OK.has(action)) {
    return { ok: false, action, reason: 'control_unavailable' };
  }
  if (!controlAvailable || !session) {
    return { ok: false, action, reason: controlReason || 'control_unavailable' };
  }
  const result = await sendDacpCommand(session, action);
  if (!result.ok) {
    controlAvailable = false;
    controlReason = result.reason || 'dacp_probe_failed';
    emitControlChange();
  }
  return { ok: result.ok, action, reason: result.ok ? null : result.reason };
};

const ACTION_OK = new Set(['play', 'pause', 'toggle', 'next', 'prev']);
