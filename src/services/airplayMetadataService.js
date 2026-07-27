import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyMetadataUpdate,
  createEmptyPlaybackState,
  toPublicState,
} from '../lib/metadataParser.js';
import {
  createPipeReader,
  itemToUpdate,
  saveArtwork,
} from '../lib/metadataPipeReader.js';
import {
  clearControlSession,
  getControlState,
  updateControlSessionField,
} from './playbackControlService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const ARTWORK_DIR = path.join(projectRoot, 'src/public/artwork');
const METADATA_PIPE = process.env.METADATA_PIPE || '/tmp/shairport-sync-metadata';
const CODE_PFLs = 0x70666c73;

let state = createEmptyPlaybackState();
let watcherStarted = false;
let pipeHandle = null;
let lastProgressNotify = 0;
let lastPflsAt = 0;
let lastPbegAt = 0;
let lastIgnoredConnectPendAt = 0;
const listeners = new Set();

const PEND_GRACE_MS = 3000;
const AEND_AFTER_CONNECT_PEND_MS = 12000;

const DEBUG = process.env.METADATA_DEBUG === '1';

const codeTag = (code) =>
  String.fromCharCode((code >> 24) & 0xff, (code >> 16) & 0xff, (code >> 8) & 0xff, code & 0xff);

const logDebug = (...args) => {
  if (!DEBUG) return;
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[meta ${ts}]`, ...args);
};

export const logTestMarker = (label) => {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[meta ${ts}] >>> TEST MARK: ${label}`);
};

const clearArtworkFiles = () => {
  for (const name of ['current.jpg', 'current.png']) {
    const filepath = path.join(ARTWORK_DIR, name);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
};

const notify = () => {
  const publicState = { ...toPublicState(state), ...getControlState() };
  for (const listener of listeners) listener(publicState);
};

const applyUpdate = (update) => {
  const isProgressOnly = update?.type === 'field' && update.field === 'progress';

  if (update?.type === 'event' && (update.event === 'active_end' || update.event === 'disconnect')) {
    const now = Date.now();
    if (
      update.event === 'active_end' &&
      lastIgnoredConnectPendAt &&
      now - lastIgnoredConnectPendAt < AEND_AFTER_CONNECT_PEND_MS
    ) {
      if (DEBUG) logDebug('ignored spurious aend after connect-time pend');
      lastIgnoredConnectPendAt = 0;
      return;
    }

    clearArtworkFiles();
    clearControlSession();
    state = createEmptyPlaybackState();
    lastIgnoredConnectPendAt = 0;
    if (DEBUG) logDebug('state', 'title=∅ playing=false connected=false (session ended)');
    notify();
    return;
  }

  if (update?.type === 'event' && update.event === 'play') {
    lastPbegAt = Date.now();
  }

  if (update?.type === 'field') {
    if (update.field === 'dacpId') {
      updateControlSessionField('dacpId', update.value);
      notify();
      return;
    }
    if (update.field === 'dacpPort') {
      updateControlSessionField('dacpPort', update.value);
      notify();
      return;
    }
    if (update.field === 'clientIp') {
      updateControlSessionField('clientIp', update.value);
      notify();
      return;
    }
  }

  const prev = JSON.stringify(toPublicState(state));
  state = applyMetadataUpdate(state, update);
  const next = JSON.stringify(toPublicState(state));

  if (prev === next) return;

  if (DEBUG) {
    const pub = toPublicState(state);
    logDebug(
      'state',
      `title=${pub.title ?? '∅'}`,
      `playing=${pub.isPlaying}`,
      `connected=${state.connected}`,
      `stream=${state.streamOpen}`,
    );
  }

  if (isProgressOnly) {
    const now = Date.now();
    if (now - lastProgressNotify < 1000) return;
    lastProgressNotify = now;
  }

  notify();
};

const handleItem = (item) => {
  if (item.type === 0x73736e63 && item.code === CODE_PFLs) {
    lastPflsAt = Date.now();
  }

  if (DEBUG) {
    const typeTag = codeTag(item.type);
    const tag = codeTag(item.code);
    let detail = '';
    if (item.data && item.length > 0 && item.length <= 120) {
      detail = item.data.toString('utf8');
    } else if (item.data) {
      detail = `[${item.length} bytes]`;
    }
    logDebug(`raw ${typeTag}/${tag}`, detail);
  }

  let update = itemToUpdate(item);

  if (update?.type === 'event' && update.event === 'resume' && Date.now() - lastPflsAt < 2000) {
    if (DEBUG) logDebug('update (ignored spurious prsm after pfls)');
    update = null;
  }

  if (update?.type === 'event' && update.event === 'stop') {
    const now = Date.now();
    if (now - lastPbegAt < PEND_GRACE_MS) {
      lastIgnoredConnectPendAt = now;
      if (DEBUG) logDebug('update (ignored spurious pend after pbeg)');
      update = null;
    } else {
      lastIgnoredConnectPendAt = 0;
    }
  }

  if (update?.type === 'event' && update.event === 'artwork' && update.data) {
    const pathOnly = saveArtwork(update.data, ARTWORK_DIR);
    update = {
      type: 'event',
      event: 'artwork',
      albumArt: `${pathOnly}?t=${Date.now()}`,
    };
  }

  if (update) {
    if (DEBUG) logDebug('update', JSON.stringify(update));
    applyUpdate(update);
  } else if (DEBUG) {
    logDebug('update (ignored)');
  }
};

export const onPlaybackChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getPlaybackState = () => ({ ...toPublicState(state), ...getControlState() });

export const startMetadataWatcher = () => {
  if (watcherStarted) return;
  watcherStarted = true;

  fs.mkdirSync(ARTWORK_DIR, { recursive: true });
  console.log(`Watching AirPlay metadata pipe: ${METADATA_PIPE}`);
  if (DEBUG) console.log('Metadata debug logging enabled (METADATA_DEBUG=1)');

  if (pipeHandle) pipeHandle.destroy();
  pipeHandle = createPipeReader(METADATA_PIPE, handleItem);
};
