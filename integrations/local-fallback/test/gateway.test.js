import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parseServicesConfig } from '../src/config.js';
import { createGateway } from '../src/gateway.js';

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));

const get = (port, path = '/') =>
  new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });

const makeConfig = (upstreamPort) =>
  parseServicesConfig({
    services: {
      test: {
        primary_host: '127.0.0.1',
        ports: [{ port: upstreamPort, check: 'http', path: '/api/health' }],
        proxy_to: `http://127.0.0.1:${upstreamPort}`,
        fallback_title: 'Test Service',
        recover_after: 1,
      },
    },
  });

test('healthy upstream → gateway proxies the upstream body', async () => {
  const upstream = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('UPSTREAM OK');
  });
  const upstreamPort = await listen(upstream);

  const gateway = createGateway({ config: makeConfig(upstreamPort), cacheMs: 0, timeoutMs: 1000 });
  const gwPort = await listen(gateway);

  const res = await get(gwPort, '/');
  assert.equal(res.status, 200);
  assert.equal(res.body, 'UPSTREAM OK');

  await close(gateway);
  await close(upstream);
});

test('dead upstream → gateway serves fallback page with 200 (not a connection error)', async () => {
  // Reserve a port then immediately close it so nothing is listening.
  const tmp = http.createServer();
  const deadPort = await listen(tmp);
  await close(tmp);

  const gateway = createGateway({ config: makeConfig(deadPort), cacheMs: 0, timeoutMs: 1000 });
  const gwPort = await listen(gateway);

  const res = await get(gwPort, '/');
  assert.equal(res.status, 200);
  assert.match(res.body, /is unavailable/);
  assert.match(res.body, /down/);

  await close(gateway);
});

test('/_gateway/health and /_gateway/services report status', async () => {
  const upstream = http.createServer((_req, res) => res.end('ok'));
  const upstreamPort = await listen(upstream);
  const gateway = createGateway({ config: makeConfig(upstreamPort), cacheMs: 0, timeoutMs: 1000 });
  const gwPort = await listen(gateway);

  const health = await get(gwPort, '/_gateway/health');
  assert.equal(health.status, 200);
  assert.match(health.body, /"status":"ok"/);

  const services = await get(gwPort, '/_gateway/services');
  assert.equal(services.status, 200);
  const parsed = JSON.parse(services.body);
  assert.equal(parsed.services.test.status, 'up');
  assert.equal(parsed.services.test.proxying, true);

  await close(gateway);
  await close(upstream);
});
