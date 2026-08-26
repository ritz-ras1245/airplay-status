/**
 * Pure display-state rules for the always-on kiosk view.
 *
 * These implement the shared behaviour contract in
 * specs/guidelines/always-on-display-client.md and are the single source of
 * truth for both the browser client (display.js) and the Node unit tests.
 * Keep this module free of DOM/browser/Node APIs so it stays testable.
 */

/**
 * Classify a playback snapshot into a display mode.
 * Idle semantics match the dashboard: nothing playing AND no track present.
 * @param {{isPlaying?: boolean, title?: string|null}|null|undefined} playback
 * @returns {'playing'|'paused'|'idle'}
 */
export const classifyPlayback = (playback) => {
  if (!playback || (!playback.isPlaying && !playback.title)) return 'idle';
  return playback.isPlaying ? 'playing' : 'paused';
};

/** @param {ReturnType<typeof classifyPlayback>} mode */
export const isActive = (mode) => mode === 'playing' || mode === 'paused';

/**
 * Focus-before-idle resume decision.
 *
 * Only nudge ("tap to resume") when the screen had been dimmed off AND the
 * client was the focused/foreground session when it went dark AND playback has
 * just started again. Otherwise stay silent (do not spam every display).
 *
 * @param {{focusBeforeIdle: boolean, screenDimmed: boolean, startedPlaying: boolean}} args
 * @returns {boolean}
 */
export const shouldNudgeResume = ({ focusBeforeIdle, screenDimmed, startedPlaying }) =>
  Boolean(focusBeforeIdle && screenDimmed && startedPlaying);

/**
 * Whether a wake lock should be held for a given display mode.
 * Hold while something is active (playing or paused-with-track); release when idle.
 * @param {ReturnType<typeof classifyPlayback>} mode
 * @returns {boolean}
 */
export const shouldHoldWakeLock = (mode) => isActive(mode);
