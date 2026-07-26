#!/usr/bin/env node
/**
 * Watch shairport-sync metadata pipe and emit JSON playback state updates.
 * Usage: npm run watch:metadata
 */
import {
  onPlaybackChange,
  startMetadataWatcher,
} from '../services/airplayMetadataService.js';

startMetadataWatcher();
onPlaybackChange((state) => {
  process.stdout.write(`${JSON.stringify(state)}\n`);
});
