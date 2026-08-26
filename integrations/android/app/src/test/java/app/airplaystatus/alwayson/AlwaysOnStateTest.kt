package app.airplaystatus.alwayson

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AlwaysOnStateTest {

    @Test
    fun classifyMapsSnapshots() {
        assertEquals(Mode.PLAYING, classify(isPlaying = true, hasTitle = true))
        assertEquals(Mode.PAUSED, classify(isPlaying = false, hasTitle = true))
        assertEquals(Mode.IDLE, classify(isPlaying = false, hasTitle = false))
    }

    @Test
    fun idleToPlayWakesWithoutNudge() {
        val s = reduce(AlwaysOnState(), AlwaysOnEvent.Playback(isPlaying = true, hasTitle = true))
        assertEquals(Mode.PLAYING, s.mode)
        assertEquals(Screen.AWAKE, s.screen)
        assertFalse(s.nudge)
        assertTrue(shouldKeepScreenOn(s))
    }

    @Test
    fun playThenIdleGraceDimsAndRecordsFocus() {
        var s = reduce(AlwaysOnState(), AlwaysOnEvent.Playback(true, true))
        s = reduce(s, AlwaysOnEvent.Playback(false, false)) // idle
        assertEquals(Screen.AWAKE, s.screen) // grace not elapsed
        s = reduce(s, AlwaysOnEvent.IdleGraceElapsed(focused = true))
        assertEquals(Screen.DIM, s.screen)
        assertTrue(s.focusBeforeIdle)
        assertFalse(shouldKeepScreenOn(s))
    }

    @Test
    fun resumeWhileDimmedAndFocusedShowsNudgeThenDismiss() {
        var s = reduce(AlwaysOnState(), AlwaysOnEvent.IdleGraceElapsed(focused = true))
        s = reduce(s, AlwaysOnEvent.Playback(true, true))
        assertTrue(s.nudge)
        assertEquals(Screen.DIM, s.screen)
        s = reduce(s, AlwaysOnEvent.DismissNudge)
        assertFalse(s.nudge)
        assertEquals(Screen.AWAKE, s.screen)
    }

    @Test
    fun resumeWhileDimmedButNotFocusedIsSilent() {
        var s = reduce(AlwaysOnState(), AlwaysOnEvent.IdleGraceElapsed(focused = false))
        s = reduce(s, AlwaysOnEvent.Playback(true, true))
        assertFalse(s.nudge)
        assertEquals(Screen.AWAKE, s.screen)
    }

    @Test
    fun leavingBeforeDimClearsFocusIntent() {
        var s = reduce(AlwaysOnState(), AlwaysOnEvent.FocusLost)
        assertFalse(s.focusBeforeIdle)
        s = reduce(s, AlwaysOnEvent.IdleGraceElapsed(focused = true))
        s = reduce(s, AlwaysOnEvent.FocusLost) // ignored once dimmed
        assertTrue(s.focusBeforeIdle)
    }
}
