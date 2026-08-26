package app.airplaystatus.alwayson

import kotlinx.coroutines.flow.MutableStateFlow

/** Playback snapshot mirrored from airplay-status /api/status. */
data class Playback(
    val isPlaying: Boolean = false,
    val title: String? = null,
    val artist: String? = null,
    val album: String? = null,
    val source: String? = null,
)

/**
 * Shared, process-wide state between the watch service (producer) and the
 * Activity (consumer). Kept tiny and framework-light on purpose.
 */
object PlaybackRepository {
    /** Always-on state machine result, updated by the service. */
    val state = MutableStateFlow(AlwaysOnState())

    /** Latest playback snapshot for any UI that wants it. */
    val playback = MutableStateFlow<Playback?>(null)

    /** True while the Activity is in the foreground (drives focus-before-idle). */
    @Volatile
    var focused: Boolean = false
}
