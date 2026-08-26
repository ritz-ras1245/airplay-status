import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGatewayPage } from '../src/gatewayPage.js';

const services = {
  'airplay-status': {
    status: 'up',
    proxying: true,
    primaryHost: '192.168.1.50',
    ports: [{ port: 3003, check: 'http', up: true, latencyMs: 4, error: null }],
  },
  grafana: {
    status: 'down',
    proxying: false,
    primaryHost: '192.168.1.60',
    ports: [{ port: 3000, check: 'tcp', up: false, latencyMs: null, error: 'ECONNREFUSED' }],
  },
};

test('renderGatewayPage lists every service and its status', () => {
  const html = renderGatewayPage({ uptimeSec: 42 }, services, 5);
  assert.match(html, /airplay-status/);
  assert.match(html, /grafana/);
  assert.match(html, /badge--up/);
  assert.match(html, /badge--down/);
  assert.match(html, /proxying/);
  assert.match(html, /serving fallback/);
  assert.match(html, /http-equiv="refresh" content="5"/);
  assert.match(html, /_gateway\/services/);
});

test('renderGatewayPage escapes and handles empty services', () => {
  const html = renderGatewayPage({ uptimeSec: 0 }, {}, 5);
  assert.match(html, /No services configured/);
});
