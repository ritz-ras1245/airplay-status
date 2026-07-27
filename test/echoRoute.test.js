import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { describe, it, before, after } from 'node:test';

const PORT = 3099;
const BASE = `http://127.0.0.1:${PORT}`;

let proc;

const waitForServer = async (timeoutMs = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/version`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
};

describe('GET /echo', () => {
  before(async () => {
    proc = spawn('node', ['src/index.js'], {
      env: {
        ...process.env,
        PORT: String(PORT),
        USE_MOCK: 'true',
        SKIP_SHAIRPORT_CHECK: '1',
      },
      stdio: 'ignore',
    });
    await waitForServer();
  });

  after(() => {
    if (proc && !proc.killed) proc.kill('SIGTERM');
  });

  it('returns 200 with SSE client script', async () => {
    const res = await fetch(`${BASE}/echo`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /echo\.js/);
    assert.match(html, /Nothing playing|echo-empty/);
  });

  it('renders playing state via mock API path', async () => {
    const res = await fetch(`${BASE}/echo?mock=true`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Señorita/);
    assert.match(html, /echo-playing/);
  });
});
