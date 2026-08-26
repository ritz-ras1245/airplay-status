package app.airplaystatus.alwayson

/**
 * Pure always-on display state machine for the P7 Android client.
 *
 * Mirrors the shared rules in
 * specs/guidelines/always-on-display-client.md (and the JS/DeskThing version in
 * integrations/deskthing/shared/alwaysOnState.js). Kept free of Android APIs so
 * it runs as plain JVM unit tests (see AlwaysOnStateTest).
 */

enum class Mode { PLAYING, PAUSED, IDLE }
enum class Screen { AWAKE, DIM }

data class AlwaysOnState(
    val mode: Mode = Mode.IDLE,
    val screen: Screen = Screen.AWAKE,
    val focusBeforeIdle: Boolean = false,
    val nudge: Boolean = false,
)

sealed interface AlwaysOnEvent {
    /** A fresh /api/status snapshot. */
    data class Playback(val isPlaying: Boolean, val hasTitle: Boolean) : AlwaysOnEvent
    /** The idle grace period elapsed; `focused` = was this app foreground now. */
    data class IdleGraceElapsed(val focused: Boolean) : AlwaysOnEvent
    /** The user left the app before it dimmed. */
    data object FocusLost : AlwaysOnEvent
    /** The user tapped the resume nudge. */
    data object DismissNudge : AlwaysOnEvent
}

fun classify(isPlaying: Boolean, hasTitle: Boolean): Mode = when {
    !isPlaying && !hasTitle -> Mode.IDLE
    isPlaying -> Mode.PLAYING
    else -> Mode.PAUSED
}

fun reduce(state: AlwaysOnState, event: AlwaysOnEvent): AlwaysOnState = when (event) {
    is AlwaysOnEvent.Playback -> {
        val mode = classify(event.isPlaying, event.hasTitle)
        when {
            mode == Mode.IDLE -> state.copy(mode = Mode.IDLE, nudge = false)
            state.screen == Screen.DIM && state.focusBeforeIdle ->
                state.copy(mode = mode, nudge = true) // resume nudge; wait for tap
            state.screen == Screen.DIM ->
                state.copy(mode = mode, screen = Screen.AWAKE, nudge = false) // silent wake
            else -> state.copy(mode = mode, screen = Screen.AWAKE, nudge = false)
        }
    }

    is AlwaysOnEvent.IdleGraceElapsed ->
        if (state.mode != Mode.IDLE) state
        else state.copy(screen = Screen.DIM, focusBeforeIdle = event.focused)

    AlwaysOnEvent.FocusLost ->
        if (state.screen == Screen.DIM) state else state.copy(focusBeforeIdle = false)

    AlwaysOnEvent.DismissNudge ->
        state.copy(screen = Screen.AWAKE, nudge = false)
}

/** Whether the Activity should hold FLAG_KEEP_SCREEN_ON right now. */
fun shouldKeepScreenOn(state: AlwaysOnState): Boolean =
    state.screen == Screen.AWAKE && (state.mode == Mode.PLAYING || state.mode == Mode.PAUSED)
