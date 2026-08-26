const COMMAND_TIMEOUT_MS = 3000;

const normalizeClientIp = (raw) => {
  const ip = String(raw ?? '').trim();
  if (!ip) return null;
  if (ip.includes(':') && !ip.startsWith('[')) {
    return `[${ip}]`;
  }
  return ip;
};

const buildUrl = (session, command) => {
  const host = normalizeClientIp(session.clientIp);
  if (!host || !session.dacpPort) return null;

  const params = new URLSearchParams({ command });
  if (session.dacpId) {
    params.set('active-remote', session.dacpId);
  }

  return `http://${host}:${session.dacpPort}/ctrl?${params.toString()}`;
};

const mapFetchError = (err) => {
  if (err?.name === 'AbortError') return 'dacp_timeout';
  if (err?.code === 'ECONNREFUSED' || err?.code === 'EHOSTUNREACH') {
    return 'dacp_unreachable';
  }
  return 'dacp_error';
};

/**
 * Send a DACP command to the AirPlay sender.
 * Never throws — returns { ok: true } or { ok: false, reason }.
 */
export const sendCommand = async (session, command) => {
  if (!session?.dacpId || !session?.dacpPort || !session?.clientIp) {
    return { ok: false, reason: 'no_session' };
  }

  const url = buildUrl(session, command);
  if (!url) return { ok: false, reason: 'no_session' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMMAND_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.text().catch(() => '');

    if (!res.ok) {
      const hint = body.trim().slice(0, 120);
      return {
        ok: false,
        reason: hint ? `dacp_http_${res.status}` : 'dacp_probe_failed',
      };
    }

    const lower = body.toLowerCase();
    if (lower.includes('error') || lower.includes('failed')) {
      return { ok: false, reason: 'dacp_probe_failed' };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: mapFetchError(err) };
  } finally {
    clearTimeout(timer);
  }
};

/** Low-impact probe after session establish. */
export const probeSession = (session) => sendCommand(session, 'status');
