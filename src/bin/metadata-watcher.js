#!/usr/bin/env node
/**
 * Watch shairport-sync metadata pipe and emit JSON playback state updates.
 * Usage: node src/bin/metadata-watcher.js
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyMetadataUpdate,
  createEmptyPlaybackState,
  parseMetadataLine,
} from '../lib/metadataParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const METADATA_PIPE = process.env.METADATA_PIPE || '/tmp/shairport-sync-metadata';
const METADATA_READER =
  process.env.METADATA_READER ||
  path.join(projectRoot, 'vendor/shairport-sync-metadata-reader/shairport-sync-metadata-reader');

let state = createEmptyPlaybackState();

const emit = (update) => {
  state = applyMetadataUpdate(state, update);
  process.stdout.write(`${JSON.stringify(state)}\n`);
};

const start = () => {
  const reader = spawn('sh', ['-c', `${METADATA_READER} < ${METADATA_PIPE}`], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  reader.stdout.setEncoding('utf8');

  let buffer = '';
  reader.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const update = parseMetadataLine(line);
      if (update) emit(update);
    }
  });

  reader.on('close', (code) => {
    console.error(`metadata reader exited (${code}), retrying in 2s...`);
    setTimeout(start, 2000);
  });

  reader.on('error', (err) => {
    console.error(`metadata reader error: ${err.message}`);
    process.exit(1);
  });
};

console.error(`Watching metadata pipe: ${METADATA_PIPE}`);
console.error(`Using reader: ${METADATA_READER}`);
start();
