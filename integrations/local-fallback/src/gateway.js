import http from 'node:http';
import { resolveService } from './config.js';
import { probeService, shouldProxy } from './probe.js';
import { renderFallbackPage } from './fallbackPage.js';
import { renderGatewayPage } from './gatewayPage.js';

/**
 * Create the fallback gateway HTTP server (not yet listening).
 *
 * @param {object} opts
 * @param {{gatewayPort:number, services:object}} opts.config
 * @param {number} [opts.timeoutMs] per-probe timeout
 * @param {number} [opts.cacheMs] reuse probe results within this window
 * @param {(service:object, timeoutMs:number)=>Promise<{status:string,ports:Array}>} [opts.probeImpl]
 */
export const createGateway = ({ config, timeoutMs = 2000, cacheMs = 3000, probeImpl = probeService }) => {
  const startedAt = Date.now();
  const state = new Map(); // service name -> { result, at, effective, consecutiveUp }

  const evaluate = async (service) => {
    const prev = state.get(service.name);
    if (prev && Date.now() - prev.at < cacheMs) {
      return { status: prev.effective, ports: prev.result.ports };
    }

    const result = await probeImpl(service, timeoutMs);
    let consecutiveUp = prev?.consecutiveUp ?? 0;
    let effective;

    if (result.status === 'up') {
      consecutiveUp += 1;
      effective = prev?.effective === 'up' || consecutiveUp >= service.recoverAfter ? 'up' : 'degraded';
    } else {
      consecutiveUp = 0;
      effective = result.status; // 'down' or 'degraded'
    }

    state.set(service.name, { result, at: Date.now(), effective, consecutiveUp });
    return { status: effective, ports: result.ports };
  };

  const sendJson = (res, code, body) => {
    const payload = JSON.stringify(body);
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
    res.end(payload);
  };

  const sendHtml = (res, code, html) => {
    res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) });
    res.end(html);
  };

  const snapshotServices = async () => {
    const services = {};
    for (const service of Object.values(config.services)) {
      const health = await evaluate(service);
      services[service.name] = {
        status: health.status,
        proxying: shouldProxy(health.status),
        primaryHost: service.primaryHost,
        ports: health.ports,
      };
    }
    return services;
  };

  const sendFallback = (res, service, health) => {
    const html = renderFallbackPage(service, health);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) });
    res.end(html);
  };

  const proxy = (req, res, service, health) => {
    let target;
    try {
      target = new URL(service.proxyTo);
    } catch {
      sendFallback(res, service, health);
      return;
    }

    const upstream = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 80,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: target.host },
      },
      (upRes) => {
        res.writeHead(upRes.statusCode || 502, upRes.headers);
        upRes.pipe(res);
      },
    );

    upstream.on('error', () => {
      if (!res.headersSent) sendFallback(res, service, health);
      else res.destroy();
    });

    req.pipe(upstream);
  };

  const server = http.createServer(async (req, res) => {
    try {
      const path = req.url.split('?')[0];

      if (path === '/_gateway/health') {
        sendJson(res, 200, { status: 'ok', uptimeSec: Math.floor((Date.now() - startedAt) / 1000) });
        return;
      }

      if (path === '/_gateway/services') {
        const services = await snapshotServices();
        sendJson(res, 200, { gateway: { status: 'ok', uptimeSec: Math.floor((Date.now() - startedAt) / 1000) }, services });
        return;
      }

      if (path === '/_gateway' || path === '/_gateway/') {
        const services = await snapshotServices();
        const html = renderGatewayPage(
          { uptimeSec: Math.floor((Date.now() - startedAt) / 1000) },
          services,
        );
        sendHtml(res, 200, html);
        return;
      }

      const service = resolveService(config.services, req.headers.host);
      if (!service) {
        sendJson(res, 503, { error: 'no service configured' });
        return;
      }

      const health = await evaluate(service);
      if (shouldProxy(health.status) && service.proxyTo) {
        proxy(req, res, service, health);
      } else {
        sendFallback(res, service, health);
      }
    } catch (err) {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
    }
  });

  return server;
};
