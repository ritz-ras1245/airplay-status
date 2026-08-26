/**
 * Parse and validate the local-fallback gateway config.
 *
 * Config is JSON (dependency-free; a YAML loader can be layered on later).
 * Shape:
 * {
 *   "gateway_http_port": 8080,
 *   "services": {
 *     "airplay-status": {
 *       "hostname": "airplay-status.home.arpa",   // optional Host-header match
 *       "primary_host": "192.168.1.50",
 *       "ports": [ { "port": 3003, "check": "http", "path": "/api/health" } ],
 *       "proxy_to": "http://192.168.1.50:3003",
 *       "fallback_title": "AirPlay Status",
 *       "recover_after": 2
 *     }
 *   }
 * }
 */

export const DEFAULT_CHECK = 'tcp';
export const DEFAULT_GATEWAY_PORT = 8080;

const VALID_CHECKS = new Set(['tcp', 'http']);

export const parseServicesConfig = (raw) => {
  const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!cfg || typeof cfg !== 'object') {
    throw new Error('config must be an object');
  }
  if (!cfg.services || typeof cfg.services !== 'object' || Array.isArray(cfg.services)) {
    throw new Error('config must have a "services" object');
  }

  const names = Object.keys(cfg.services);
  if (names.length === 0) {
    throw new Error('config "services" must have at least one entry');
  }

  const services = {};
  for (const name of names) {
    const svc = cfg.services[name];
    if (!svc || typeof svc !== 'object') {
      throw new Error(`service "${name}" must be an object`);
    }
    if (!svc.primary_host || typeof svc.primary_host !== 'string') {
      throw new Error(`service "${name}": primary_host is required`);
    }
    if (!Array.isArray(svc.ports) || svc.ports.length === 0) {
      throw new Error(`service "${name}": ports[] must be a non-empty array`);
    }

    const ports = svc.ports.map((p, i) => {
      const port = Number(p.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`service "${name}" ports[${i}]: invalid port ${p.port}`);
      }
      const check = (p.check || DEFAULT_CHECK).toLowerCase();
      if (!VALID_CHECKS.has(check)) {
        throw new Error(`service "${name}" ports[${i}]: check must be tcp|http`);
      }
      return {
        port,
        check,
        path: p.path || '/',
        expectStatus: p.expect_status ? Number(p.expect_status) : null,
      };
    });

    const recoverAfter = Number(svc.recover_after ?? 2);

    services[name] = {
      name,
      hostname: svc.hostname || null,
      primaryHost: svc.primary_host,
      ports,
      proxyTo: svc.proxy_to || null,
      fallbackTitle: svc.fallback_title || name,
      recoverAfter: Number.isInteger(recoverAfter) && recoverAfter > 0 ? recoverAfter : 2,
    };
  }

  const gatewayPort = Number(
    cfg.gateway_http_port || process.env.GATEWAY_HTTP_PORT || DEFAULT_GATEWAY_PORT,
  );

  return { gatewayPort, services };
};

/**
 * Pick the service that should handle a request, matching the Host header
 * against each service's `hostname` (case-insensitive, port stripped).
 * Falls back to the first service when nothing matches (single-service setups).
 */
export const resolveService = (services, hostHeader) => {
  const host = String(hostHeader || '').split(':')[0].toLowerCase();
  const list = Object.values(services);
  const match = list.find((s) => s.hostname && s.hostname.toLowerCase() === host);
  return match || list[0] || null;
};
