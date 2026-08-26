import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseServicesConfig, resolveService } from '../src/config.js';

const valid = {
  gateway_http_port: 8080,
  services: {
    'airplay-status': {
      hostname: 'airplay-status.home.arpa',
      primary_host: '192.168.1.50',
      ports: [
        { port: 3003, check: 'http', path: '/api/health' },
        { port: 80, check: 'tcp' },
      ],
      proxy_to: 'http://192.168.1.50:3003',
    },
  },
};

test('parseServicesConfig normalizes a valid config', () => {
  const cfg = parseServicesConfig(valid);
  assert.equal(cfg.gatewayPort, 8080);
  const svc = cfg.services['airplay-status'];
  assert.equal(svc.primaryHost, '192.168.1.50');
  assert.equal(svc.proxyTo, 'http://192.168.1.50:3003');
  assert.equal(svc.ports.length, 2);
  assert.equal(svc.ports[0].check, 'http');
  assert.equal(svc.ports[0].path, '/api/health');
  assert.equal(svc.ports[1].check, 'tcp');
  assert.equal(svc.recoverAfter, 2);
});

test('parseServicesConfig accepts a JSON string', () => {
  const cfg = parseServicesConfig(JSON.stringify(valid));
  assert.equal(cfg.services['airplay-status'].ports[0].port, 3003);
});

test('parseServicesConfig rejects invalid configs', () => {
  assert.throws(() => parseServicesConfig({}), /services/);
  assert.throws(() => parseServicesConfig({ services: {} }), /at least one/);
  assert.throws(
    () => parseServicesConfig({ services: { x: { ports: [{ port: 1 }] } } }),
    /primary_host/,
  );
  assert.throws(
    () => parseServicesConfig({ services: { x: { primary_host: 'h', ports: [] } } }),
    /non-empty/,
  );
  assert.throws(
    () => parseServicesConfig({ services: { x: { primary_host: 'h', ports: [{ port: 70000 }] } } }),
    /invalid port/,
  );
  assert.throws(
    () =>
      parseServicesConfig({ services: { x: { primary_host: 'h', ports: [{ port: 80, check: 'icmp' }] } } }),
    /tcp\|http/,
  );
});

test('resolveService matches by Host header, falls back to first', () => {
  const { services } = parseServicesConfig(valid);
  assert.equal(resolveService(services, 'airplay-status.home.arpa:8080').name, 'airplay-status');
  assert.equal(resolveService(services, 'unknown.host').name, 'airplay-status');
  assert.equal(resolveService(services, undefined).name, 'airplay-status');
});
