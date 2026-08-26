/**
 * Build the /api/health payload from operational inputs.
 *
 * Pure and side-effect free so it can be unit-tested without a running server.
 * Health reflects the live service: in mock mode the metadata watcher is not
 * running, so `metadataWatcher` is "disabled" and `nowPlaying` is false.
 */

/**
 * @param {{
 *   startedAtMs: number,
 *   nowMs: number,
 *   useMock: boolean,
 *   playing: boolean,
 *   version: string,
 *   node: string,
 *   stageId: string,
 * }} input
 */
export const buildHealth = ({
  startedAtMs,
  nowMs,
  useMock,
  playing,
  version,
  node,
  stageId,
}) => ({
  status: 'ok',
  mode: useMock ? 'mock' : 'live',
  stage: stageId,
  uptimeSec: Math.max(0, Math.floor((nowMs - startedAtMs) / 1000)),
  metadataWatcher: useMock ? 'disabled' : 'watching',
  nowPlaying: Boolean(playing),
  version,
  node,
});
