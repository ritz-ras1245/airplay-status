import { probeDacpSession, sendDacpAction } from '../lib/dacpClient.js';

const VALID_ACTIONS = new Set(['play', 'pause', 'toggle', 'next', 'prev']);

let controlSession = null;
let controlAvailable = false;
let controlReason = 'no_session';
let consecutiveFailures = 0;

export const getControlState = () => ({
  controlAvailable,
  controlReason: controlAvailable ? null : controlReason,
});

export const clearControlSession = () => {
  controlSession = null;
  controlAvailable = false;
  controlReason = 'no_session';
  consecutiveFailures = 0;
};

export const updateControlSessionField = (field, value) => {
  if (!value && value !== 0) return;

  controlSession = {
    ...(controlSession ?? {}),
    [field]: value,
    updatedAt: new Date().toISOString(),
  };

  if (controlSession.dacpId && controlSession.dacpPort && controlSession.clientIp) {
    probeSession();
  } else {
    controlAvailable = false;
    controlReason = 'no_session';
  }
};

const probeSession = async () => {
  if (!controlSession?.dacpId || !controlSession?.dacpPort || !controlSession?.clientIp) {
    controlAvailable = false;
    controlReason = 'no_session';
    return;
  }

  const result = await probeDacpSession(controlSession);
  if (result.ok) {
    controlAvailable = true;
    controlReason = null;
    consecutiveFailures = 0;
    return;
  }

  controlAvailable = false;
  controlReason = result.reason === 'no_session' ? 'no_session' : 'dacp_probe_failed';
};

export const sendControlAction = async (action) => {
  if (!VALID_ACTIONS.has(action)) {
    return { ok: false, action, reason: 'invalid_action' };
  }

  if (!controlSession?.dacpId || !controlSession?.dacpPort || !controlSession?.clientIp) {
    return { ok: false, action, reason: 'no_session' };
  }

  if (!controlAvailable) {
    return { ok: false, action, reason: controlReason ?? 'control_unavailable' };
  }

  const result = await sendDacpAction(controlSession, action);
  if (result.ok) {
    consecutiveFailures = 0;
    return { ok: true, action };
  }

  consecutiveFailures += 1;
  if (consecutiveFailures >= 2) {
    controlAvailable = false;
    controlReason = 'ios_blocked';
  } else {
    controlAvailable = false;
    controlReason = result.reason ?? 'dacp_probe_failed';
  }

  return { ok: false, action, reason: controlReason };
};

export const setMockControlState = ({ available = true, reason = null } = {}) => {
  controlAvailable = available;
  controlReason = available ? null : reason ?? 'no_session';
  if (available) {
    controlSession = {
      dacpId: 'MOCK',
      dacpPort: 3689,
      clientIp: '127.0.0.1',
      updatedAt: new Date().toISOString(),
    };
  }
};
