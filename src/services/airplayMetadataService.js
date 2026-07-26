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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const ARTWORK_DIR = path.join(projectRoot, 'src/public/artwork');
const METADATA_PIPE = process.env.METADATA_PIPE || '/tmp/shairport-sync-metadata';

let state = createEmptyPlaybackState();
let watcherStarted = false;
let pipeHandle = null;
let lastProgressNotify = 0;
const listeners = new Set();

const notify = () => {
  const publicState = toPublicState(state);
  for (const listener of listeners) listener(publicState);
};

const applyUpdate = (update) => {
  const isProgressOnly = update?.type === 'field' && update.field === 'progress';

  const prev = JSON.stringify(toPublicState(state));
  state = applyMetadataUpdate(state, update);
  const next = JSON.stringify(toPublicState(state));

  if (prev === next) return;

  if (isProgressOnly) {
    const now = Date.now();
    if (now - lastProgressNotify < 1000) return;
    lastProgressNotify = now;
  }

  notify();
};

const handleItem = (item) => {
  let update = itemToUpdate(item);

  if (update?.type === 'event' && update.event === 'artwork' && update.data) {
    const pathOnly = saveArtwork(update.data, ARTWORK_DIR);
    update = {
      type: 'event',
      event: 'artwork',
      albumArt: `${pathOnly}?t=${Date.now()}`,
    };
  }

  if (update) applyUpdate(update);
};

export const onPlaybackChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getPlaybackState = () => toPublicState(state);

export const startMetadataWatcher = () => {
  if (watcherStarted) return;
  watcherStarted = true;

  fs.mkdirSync(ARTWORK_DIR, { recursive: true });
  console.log(`Watching AirPlay metadata pipe: ${METADATA_PIPE}`);

  if (pipeHandle) pipeHandle.destroy();
  pipeHandle = createPipeReader(METADATA_PIPE, handleItem);
};
