const PROBE_TIMEOUT_MS = 3000;
const COMMAND_TIMEOUT_MS = 3000;

const ACTION_COMMANDS = {
  play: 'play',
  pause: 'pause',
  toggle: 'playpause',
  next: 'nextitem',
  prev: 'previtem',
  status: 'status',
};

const normalizeClientIp = (ip) => {
  if (!ip) return null;
  const trimmed = String(ip).trim();
  if (trimmed.includes(':') && !trimmed.startsWith('[')) {
    return `[${trimmed}]`;
  }
  return trimmed;
};

const buildUrl = (session, command) => {
  const host = normalizeClientIp(session.clientIp);
  const port = session.dacpPort;
  const id = session.dacpId;
  if (!host || !port || !id) return null;

  const params = new URLSearchParams({ command });
  params.set('active-remote', id);
  return `http://${host}:${port}/ctrl?${params.toString()}`;
};

const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
};

export const sendDacpCommand = async (session, command) => {
  const url = buildUrl(session, command);
  if (!url) {
    return { ok: false, reason: 'no_session' };
  }

  const result = await fetchWithTimeout(url, COMMAND_TIMEOUT_MS);
  if (result.error) {
    return { ok: false, reason: 'dacp_probe_failed', detail: result.error };
  }

  if (!result.ok) {
    return { ok: false, reason: 'dacp_probe_failed', detail: `HTTP ${result.status}` };
  }

  return { ok: true };
};

export const probeDacpSession = async (session) => sendDacpCommand(session, ACTION_COMMANDS.status);

export const sendDacpAction = async (session, action) => {
  const command = ACTION_COMMANDS[action];
  if (!command) {
    return { ok: false, reason: 'invalid_action' };
  }
  return sendDacpCommand(session, command);
};

export const PROBE_TIMEOUT = PROBE_TIMEOUT_MS;
