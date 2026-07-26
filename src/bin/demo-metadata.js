#!/usr/bin/env node
/**
 * Demo: feed sample metadata-reader output through the parser.
 * Usage: npm run demo
 */
import {
  applyMetadataUpdate,
  createEmptyPlaybackState,
  parseMetadataLine,
} from '../lib/metadataParser.js';

const SAMPLE_LINES = [
  'The AirPlay client at "192.168.1.10" has connected to this player.',
  'Play Session Begin.',
  'The name of the AirPlay client is "Demo Mac".',
  'Title: "Señorita".',
  'Artist: "Shawn Mendes, Camila Cabello".',
  'Album Name: "Señorita".',
  'Track length: 191000 milliseconds.',
  'Picture received, length 52000 bytes.',
  'Progress String "95000/191000/191000".',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let state = createEmptyPlaybackState();

console.log('=== AirPlay Status — metadata parser demo ===\n');
console.log('Simulating shairport-sync-metadata-reader output...\n');

for (const line of SAMPLE_LINES) {
  console.log(`  → ${line}`);
  const update = parseMetadataLine(line);
  if (update) {
    state = applyMetadataUpdate(state, update);
    console.log(`    ${JSON.stringify(state)}\n`);
  }
  await sleep(400);
}

console.log('--- pause ---');
state = applyMetadataUpdate(state, parseMetadataLine('Pause.'));
console.log(JSON.stringify(state, null, 2));

await sleep(800);

console.log('\n--- resume ---');
state = applyMetadataUpdate(state, parseMetadataLine('Resume.'));
console.log(JSON.stringify(state, null, 2));

await sleep(800);

console.log('\n--- stop ---');
state = applyMetadataUpdate(state, parseMetadataLine('Play Session End.'));
console.log(JSON.stringify(state, null, 2));

console.log('\nDemo complete. Live test: ./bin/run-shairport.sh + AirPlay to "AirPlay Status"');
