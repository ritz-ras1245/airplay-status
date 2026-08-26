import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDacpUrl, formatDacpHost, ACTION_TO_DACP, probeDacpSession, sendDacpCommand } from '../src/lib/dacpClient.js';
import { decodePort, decodeTextOrHex } from '../src/lib/dacpSessionParse.js';
import { itemToUpdate } from '../src/lib/metadataPipeReader.js';
import { applyMockControl, getPlaybackState, resetMockPlayback } from '../src/services/mockPlaybackService.js';

test('formatDacpHost wraps IPv6', () => {
  assert.equal(formatDacpHost('fe80::1'), '[fe80::1]');
  assert.equal(formatDacpHost('10.0.0.5'), '10.0.0.5');
});

test('buildDacpUrl uses ctrl-int path', () => {
  const url = buildDacpUrl({ clientIp: '10.0.0.8', dacpPort: 3689 }, ACTION_TO_DACP.toggle);
  assert.equal(url, 'http://10.0.0.8:3689/ctrl-int/1/playpause');
});

test('decodePort reads uint32 BE', () => {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(3689);
  assert.equal(decodePort(buf), 3689);
});

test('itemToUpdate parses daid dapo clip', () => {
  const daid = itemToUpdate({
    type: 0x73736e63,
    code: 0x64616964,
    data: Buffer.from('C58E4CA45698A4C6'),
    length: 16,
  });
  assert.equal(daid.field, 'dacpId');
  const portBuf = Buffer.alloc(4);
  portBuf.writeUInt32BE(3689);
  const dapo = itemToUpdate({ type: 0x73736e63, code: 0x6461706f, data: portBuf, length: 4 });
  assert.equal(dapo.value, 3689);
  const clip = itemToUpdate({
    type: 0x73736e63,
    code: 0x636c6970,
    data: Buffer.from('10.0.0.12'),
    length: 9,
  });
  assert.equal(clip.value, '10.0.0.12');
});

test('decodeTextOrHex hex-encodes binary', () => {
  assert.equal(decodeTextOrHex(Buffer.from('AB')), 'AB');
});

test('probe treats any HTTP response as DACP port up', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404 });
  const result = await probeDacpSession(
    { clientIp: '127.0.0.1', dacpPort: 9, dacpId: 'x' },
    { fetchImpl },
  );
  assert.equal(result.ok, true);
});

test('sendDacpCommand maps network failure', async () => {
  const fetchImpl = async () => {
    throw new Error('ECONNREFUSED');
  };
  const result = await sendDacpCommand(
    { clientIp: '127.0.0.1', dacpPort: 9, dacpId: 'x' },
    'pause',
    { fetchImpl },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'dacp_probe_failed');
});

test('mock control toggles preview playback', async () => {
  resetMockPlayback();
  applyMockControl('pause');
  const paused = await getPlaybackState();
  assert.equal(paused.isPlaying, false);
  applyMockControl('play');
  const playing = await getPlaybackState();
  assert.equal(playing.isPlaying, true);
  assert.equal(playing.controlAvailable, true);
});
