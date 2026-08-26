import net from 'node:net';
import http from 'node:http';

/**
 * Normalize a raw probe outcome into a stable result record.
 * Pure — unit-testable without sockets.
 * @param {{ok: boolean, latencyMs?: number, error?: string|null}} raw
 */
export const classifyProbe = ({ ok, latencyMs = null, error = null }) => ({
  up: Boolean(ok),
  latencyMs: ok ? latencyMs : null,
  error: ok ? null : error || 'down',
  checkedAt: new Date().toISOString(),
});

/**
 * Roll up per-port results into an overall service status.
 * Pure — unit-testable.
 * @param {Array<{up: boolean}>} portResults
 * @returns {'up'|'degraded'|'down'}
 */
export const classifyService = (portResults) => {
  if (!Array.isArray(portResults) || portResults.length === 0) return 'down';
  const ups = portResults.filter((r) => r.up).length;
  if (ups === portResults.length) return 'up';
  if (ups === 0) return 'down';
  return 'degraded';
};

/** Only proxy to the primary when every probed port is healthy. */
export const shouldProxy = (status) => status === 'up';

export const tcpProbe = (host, port, timeoutMs = 2000) =>
  new Promise((resolve) => {
    const start = Date.now();
    const socket = net.connect({ host, port });
    const finish = (ok, error) => {
      socket.destroy();
      resolve(classifyProbe({ ok, latencyMs: Date.now() - start, error }));
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', (err) => finish(false, err.code || err.message));
  });

export const httpProbe = (host, port, path = '/', expectStatus = null, timeoutMs = 2000) =>
  new Promise((resolve) => {
    const start = Date.now();
    const finish = (ok, error) => resolve(classifyProbe({ ok, latencyMs: Date.now() - start, error }));

    const req = http.get({ host, port, path, timeout: timeoutMs }, (res) => {
      res.resume();
      const code = res.statusCode ?? 0;
      const ok = expectStatus ? code === expectStatus : code >= 200 && code < 400;
      finish(ok, `status ${code}`);
    });
    req.on('timeout', () => {
      req.destroy();
      finish(false, 'timeout');
    });
    req.on('error', (err) => finish(false, err.code || err.message));
  });

/** Probe a single port spec against a host. */
export const probePort = (host, portSpec, timeoutMs = 2000) =>
  portSpec.check === 'http'
    ? httpProbe(host, portSpec.port, portSpec.path, portSpec.expectStatus, timeoutMs)
    : tcpProbe(host, portSpec.port, timeoutMs);

/** Probe every port of a service and return { status, ports }. */
export const probeService = async (service, timeoutMs = 2000) => {
  const ports = await Promise.all(
    service.ports.map(async (spec) => ({
      port: spec.port,
      check: spec.check,
      ...(await probePort(service.primaryHost, spec, timeoutMs)),
    })),
  );
  return { status: classifyService(ports), ports };
};
