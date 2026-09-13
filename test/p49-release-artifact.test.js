import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const INSTALL = 'deploy/rpi/release/install-release.sh';
const DOCKERFILE = 'deploy/rpi/release/Dockerfile';
const FLAGS = 'deploy/rpi/release/shairport-configure-flags.txt';
const VERSIONS = 'deploy/rpi/release/versions.env';

const compileCmd = /^\s*(make|cmake|npm\s+(ci|install)|git\s+clone|autoreconf|\.\/configure)\b/;

test('in-tarball installer does not compile, clone, or npm-install', () => {
  const src = read(INSTALL);
  const hits = src.split('\n').filter((line) => {
    if (/^\s*#/.test(line)) return false;
    return compileCmd.test(line);
  });
  assert.deepEqual(hits, [], `forbidden commands:\n${hits.join('\n')}`);
  assert.match(src, /RUNTIME_DEBS/);
  assert.match(src, /apt-get install/);
  assert.match(src, /nqptp/);
  assert.match(src, /shairport-sync/);
  assert.match(src, /airplay-status/);
});

test('shairport configure flags match the P49 bring-up (install.sh source of truth)', () => {
  const flags = read(FLAGS);
  for (const required of [
    '--with-airplay-2',
    '--with-pipe',
    '--with-metadata',
    '--with-avahi',
    '--with-ssl=mbedtls',
    '--sysconfdir=/etc',
  ]) {
    assert.match(flags, new RegExp(required.replace(/[.]/g, '\\.')));
  }
  const docker = read(DOCKERFILE);
  assert.match(docker, /shairport-configure-flags\.txt/);
  assert.match(docker, /nqptp-configure-flags\.txt/);
  assert.match(docker, /FROM debian:trixie-slim/);
  assert.match(docker, /npm ci --omit=dev/);
  assert.match(docker, /pixlet_\$\{PIXLET_VERSION\}_linux_arm64\.tar\.gz/);
});

test('pinned versions match historical install.sh defaults', () => {
  const env = read(VERSIONS);
  assert.match(env, /NQPTP_VERSION=1\.2\.4/);
  assert.match(env, /SHAIRPORT_VERSION=4\.3\.6/);
  assert.match(env, /PIXLET_VERSION=0\.34\.0/);
});

test('RUNTIME_DEBS lists thin runtime packages only', () => {
  const debs = read('deploy/rpi/release/RUNTIME_DEBS.txt');
  assert.match(debs, /^avahi-daemon$/m);
  assert.match(debs, /^nodejs$/m);
  const banned = debs.split('\n').filter((line) => /(-dev|build-essential|g\+\+|cmake)\b/.test(line) && !line.startsWith('#'));
  assert.deepEqual(banned, []);
});

test('on-Pi compile is gated behind --break-glass-compile', () => {
  const wrapper = spawnSync('bash', [path.join(root, 'deploy/rpi/install.sh')], { encoding: 'utf8' });
  assert.notEqual(wrapper.status, 0);
  assert.match(wrapper.stderr + wrapper.stdout, /break-glass-compile/);
  assert.match(wrapper.stderr + wrapper.stdout, /p49-build-release/);
});

test('p49-build-release.sh --dry-run and --help', () => {
  const help = spawnSync('bash', [path.join(root, 'bin/p49-build-release.sh'), '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /linux\/arm64/);
  const dry = spawnSync('bash', [path.join(root, 'bin/p49-build-release.sh'), '--dry-run', '--tag', 'v0.0.0-test'], {
    encoding: 'utf8',
  });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /dry-run/);
  assert.match(dry.stdout, /linux\/arm64/);
});

test('p49-push-release.sh rejects r-bot and requires a tarball', () => {
  const bot = spawnSync('bash', [path.join(root, 'bin/p49-push-release.sh'), 'r-bot@pi.home.arpa'], { encoding: 'utf8' });
  assert.notEqual(bot.status, 0);
  assert.match(bot.stderr, /cannot sudo/);
  const missing = spawnSync('bash', [path.join(root, 'bin/p49-push-release.sh'), 'rasohoni@pi.home.arpa'], {
    encoding: 'utf8',
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /No tarball|Missing checksum/);
});

test('in-tarball install.sh --dry-run walks unpack steps', () => {
  const tmp = path.join(root, 'artifacts', 'releases', '.test-tree');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(path.join(tmp, 'usr/local/bin'), { recursive: true });
  mkdirSync(path.join(tmp, 'opt/airplay-status/src'), { recursive: true });
  mkdirSync(path.join(tmp, 'opt/airplay-status/node_modules'), { recursive: true });
  mkdirSync(path.join(tmp, 'etc/systemd/system'), { recursive: true });
  for (const bin of ['nqptp', 'shairport-sync', 'pixlet']) {
    const p = path.join(tmp, 'usr/local/bin', bin);
    writeFileSync(p, '#!/bin/true\n');
    chmodSync(p, 0o755);
  }
  writeFileSync(path.join(tmp, 'RUNTIME_DEBS.txt'), 'avahi-daemon\nnodejs\n');
  writeFileSync(path.join(tmp, 'etc/systemd/system/nqptp.service'), '[Unit]\n');
  writeFileSync(path.join(tmp, 'etc/systemd/system/shairport-sync.service'), '[Unit]\n');
  writeFileSync(path.join(tmp, 'etc/systemd/system/airplay-status.service'), '[Unit]\n');
  writeFileSync(path.join(tmp, 'install.sh'), read(INSTALL));
  chmodSync(path.join(tmp, 'install.sh'), 0o755);

  const result = spawnSync('bash', [path.join(tmp, 'install.sh'), '--dry-run'], { encoding: 'utf8' });
  rmSync(tmp, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /dry-run/);
  assert.match(result.stdout, /apt-get/);
  assert.match(result.stdout, /nqptp/);
});

test('release helper scripts are present', () => {
  const names = readdirSync(path.join(root, 'deploy/rpi/release'));
  for (const required of [
    'Dockerfile',
    'install-release.sh',
    'pack-release.sh',
    'remote-unpack.sh',
    'RUNTIME_DEBS.txt',
    'versions.env',
  ]) {
    assert.ok(names.includes(required), required);
  }
});
