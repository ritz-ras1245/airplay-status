/**
 * Classic AirPlay / iTunes Remote (DACP) HTTP client.
 * Does not implement AirPlay 2 Media Remote Protocol (MRP).
 */

export const ACTION_TO_DACP = {
  play: 'play',
  pause: 'pause',
  toggle: 'playpause',
  next: 'nextitem',
  prev: 'previtem',
};

const DEFAULT_TIMEOUT_MS = 3000;

export const formatDacpHost = (ip) => {
  const trimmed = String(ip ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.includes(':') && !trimmed.startsWith('[')) {
    const [addr, zone] = trimmed.split('%');
    const host = `[${addr}]`;
    return zone ? `${host}` : host;
  }
  return trimmed;
};

export const buildDacpUrl = (session, dacpCommand) => {
  const host = formatDacpHost(session.clientIp);
  const port = Number(session.dacpPort);
  if (!host || !Number.isFinite(port) || port <= 0) {
    return null;
  }
  return `http://${host}:${port}/ctrl-int/1/${dacpCommand}`;
};

export const probeDacpSession = async (session, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const url = buildDacpUrl(session, 'playstatusupdate');
  if (!url) return { ok: false, reason: 'no_session' };
  const headers = {};
  const remote = session.activeRemote || session.dacpId;
  if (remote) headers['Active-Remote'] = String(remote);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${url}?revision-number=1`, {
      method: 'GET',
      headers,
      signal: ac.signal,
    });
    // Any HTTP response means the DACP port answered (including 404/403).
    return { ok: true, httpStatus: res.status };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      reason: 'dacp_probe_failed',
      detail: aborted ? 'timeout' : String(err?.message ?? err),
    };
  } finally {
    clearTimeout(timer);
  }
};

export const sendDacpCommand = async (session, action, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const dacpCommand = ACTION_TO_DACP[action];
  if (!dacpCommand) {
    return { ok: false, reason: 'control_unavailable', detail: `unknown action ${action}` };
  }

  const url = buildDacpUrl(session, dacpCommand);
  if (!url) {
    return { ok: false, reason: 'no_session' };
  }

  const headers = {};
  const remote = session.activeRemote || session.dacpId;
  if (remote) {
    headers['Active-Remote'] = String(remote);
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: ac.signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: 'dacp_probe_failed',
        detail: `HTTP ${res.status}`,
      };
    }
    return { ok: true, action };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      reason: 'dacp_probe_failed',
      detail: aborted ? 'timeout' : String(err?.message ?? err),
    };
  } finally {
    clearTimeout(timer);
  }
};
