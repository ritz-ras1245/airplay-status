import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { classifyProbe, classifyService, shouldProxy, tcpProbe } from '../src/probe.js';

test('classifyProbe normalizes up/down results', () => {
  const up = classifyProbe({ ok: true, latencyMs: 12 });
  assert.equal(up.up, true);
  assert.equal(up.latencyMs, 12);
  assert.equal(up.error, null);
  assert.ok(up.checkedAt);

  const down = classifyProbe({ ok: false, latencyMs: 999, error: 'ECONNREFUSED' });
  assert.equal(down.up, false);
  assert.equal(down.latencyMs, null); // latency is meaningless when down
  assert.equal(down.error, 'ECONNREFUSED');
});

test('classifyService rolls ports up into up/degraded/down', () => {
  assert.equal(classifyService([{ up: true }, { up: true }]), 'up');
  assert.equal(classifyService([{ up: true }, { up: false }]), 'degraded');
  assert.equal(classifyService([{ up: false }, { up: false }]), 'down');
  assert.equal(classifyService([]), 'down');
});

test('shouldProxy only when fully up', () => {
  assert.equal(shouldProxy('up'), true);
  assert.equal(shouldProxy('degraded'), false);
  assert.equal(shouldProxy('down'), false);
});

test('tcpProbe reports up for a live port and down for a dead one', async () => {
  const server = net.createServer((s) => s.end());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  const up = await tcpProbe('127.0.0.1', port, 1000);
  assert.equal(up.up, true);
  assert.equal(typeof up.latencyMs, 'number');

  await new Promise((r) => server.close(r));

  const down = await tcpProbe('127.0.0.1', port, 1000);
  assert.equal(down.up, false);
});
