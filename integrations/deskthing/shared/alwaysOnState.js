/**
 * Shared always-on display state machine.
 *
 * Implements the product rules from
 * ../../../specs/guidelines/always-on-display-client.md as a pure, framework-free
 * reducer so the same logic can be unit-tested and reused by the DeskThing app
 * (P8). The P7 Android client mirrors this logic in Kotlin; the P9 web client
 * uses the browser equivalent in src/public/js/displayState.js.
 *
 * State: { mode, screen, focusBeforeIdle, nudge }
 *   mode:            'playing' | 'paused' | 'idle'
 *   screen:          'awake' | 'dim'      (intent; platform maps to backlight/sleep)
 *   focusBeforeIdle: was this client the focused console when it dimmed?
 *   nudge:           show the "tap to resume" affordance right now?
 */

/** @param {{isPlaying?:boolean, title?:string|null}|null|undefined} playback */
export const classifyPlayback = (playback) => {
  if (!playback || (!playback.isPlaying && !playback.title)) return 'idle';
  return playback.isPlaying ? 'playing' : 'paused';
};

export const initialState = () => ({
  mode: 'idle',
  screen: 'awake',
  focusBeforeIdle: false,
  nudge: false,
});

/**
 * @param {ReturnType<typeof initialState>} state
 * @param {{type:'playback', playback?:object}
 *        | {type:'idleGraceElapsed', focused?:boolean}
 *        | {type:'focusLost'}
 *        | {type:'dismissNudge'}} event
 */
export const reduce = (state, event) => {
  switch (event.type) {
    case 'playback': {
      const mode = classifyPlayback(event.playback);
      if (mode === 'idle') {
        return { ...state, mode: 'idle', nudge: false };
      }
      // Active again. If we had dimmed off and this client was the focused
      // session, raise a one-shot resume nudge; otherwise wake silently.
      if (state.screen === 'dim') {
        return state.focusBeforeIdle
          ? { ...state, mode, nudge: true }
          : { ...state, mode, screen: 'awake', nudge: false };
      }
      return { ...state, mode, screen: 'awake', nudge: false };
    }

    case 'idleGraceElapsed': {
      if (state.mode !== 'idle') return state;
      return { ...state, screen: 'dim', focusBeforeIdle: Boolean(event.focused) };
    }

    case 'focusLost': {
      // Leaving the app before it dims clears the "focused-before-idle" intent.
      if (state.screen === 'dim') return state;
      return { ...state, focusBeforeIdle: false };
    }

    case 'dismissNudge':
      return { ...state, screen: 'awake', nudge: false };

    default:
      return state;
  }
};

/** Whether the platform should keep the screen on right now. */
export const shouldKeepScreenOn = (state) =>
  state.screen === 'awake' && (state.mode === 'playing' || state.mode === 'paused');
