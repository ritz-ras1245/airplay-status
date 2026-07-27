import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeEinkDisplay,
  getControlReasonMessage,
  resolveDeviceProfile,
} from '../src/lib/einkDeviceProfile.js';
import { resetEinkClientRegistry, touchEinkClient, getActiveEinkProfiles } from '../src/lib/einkClientRegistry.js';

test('resolveDeviceProfile falls back to default for unknown id', () => {
  const profile = resolveDeviceProfile('not-a-real-device');
  assert.equal(profile.deviceId, 'default');
  assert.equal(profile.showProgressBar, false);
});

test('resolveDeviceProfile loads named profile', () => {
  const profile = resolveDeviceProfile('7inch');
  assert.equal(profile.deviceId, '7inch');
  assert.equal(profile.showProgressBar, true);
  assert.ok(profile.pngWidth > 0);
});

test('computeEinkDisplay adaptive refresh while playing', () => {
  const profile = resolveDeviceProfile('7inch');
  const display = computeEinkDisplay(
    { isPlaying: true, progressMs: 60000, durationMs: 180000 },
    profile,
  );
  assert.ok(display.segmentCount >= 3);
  assert.ok(display.refreshRateSec >= profile.refreshMinSec);
  assert.ok(display.progressText.includes('/'));
});

test('getControlReasonMessage maps known reasons', () => {
  assert.match(getControlReasonMessage('ios_blocked'), /iPhone/i);
  assert.match(getControlReasonMessage('no_session'), /AirPlay Status/i);
});

test('eink client registry tracks active profiles', () => {
  resetEinkClientRegistry();
  touchEinkClient('7inch', 'html');
  assert.deepEqual(getActiveEinkProfiles(), ['7inch']);
  resetEinkClientRegistry();
});
