# AirPlay Status — Android always-on client (P7)

A tiny Kotlin app that wraps the airplay-status dashboard in a kiosk **WebView**
console. It keeps the screen on while playing, lets it turn off when idle, and
posts a **"Tap here to resume"** notification when playback resumes for a
console that was focused when it went dark. See the spec:
[`../../specs/p7-android-always-on.md`](../../specs/p7-android-always-on.md).

> **Status: authored, device-test pending.** No Android SDK/Gradle runs in the
> cloud VM, so this app is **not compiled/run in CI**. The pure state machine has
> JVM unit tests. Plugin/dependency versions are indicative — align them with
> your Android Studio / AGP version before building.

## Design (decisions)

| OD | Choice |
|----|--------|
| OD1 | `integrations/android/` monorepo |
| OD2 | `minSdk 26`, `targetSdk 34` |
| OD3 | System timeout for screen-off (no Device Owner) |
| OD4 | Short foreground service + native `/api/status` poll (WebView sleep can't stall wake logic) |

```
MainActivity (WebView → DISPLAY_URL, FLAG_KEEP_SCREEN_ON)
      ▲ observes                     ▲ focus (onStart/onStop)
      │ PlaybackRepository.state     │
PlaybackWatchService (foreground)  ──┘
  • PlaybackPoller → /api/status (+ FALLBACK_URL)
  • AlwaysOnState reduce(): idle → dim grace → focus-before-idle nudge
  • posts "Tap here to resume" notification on nudge
```

`AlwaysOnState.kt` is the pure state machine (shared rules with P8/P9). Screen-on
is applied by the Activity; the notification is posted by the service.

## Configure

Edit `buildConfigField` values in [`app/build.gradle.kts`](app/build.gradle.kts):
`DISPLAY_URL` (defaults to `…/display?client=android`), `STATUS_URL`,
`FALLBACK_URL` (P10 gateway), `IDLE_GRACE_SEC`, `POLL_SEC`.

## Build / test / install

```bash
# From integrations/android/ on a machine with Android Studio / SDK:
./gradlew test          # JVM unit tests for AlwaysOnState
./gradlew assembleDebug # build APK → app/build/outputs/apk/debug/
adb install -r app/build/outputs/apk/debug/app-debug.apk   # sideload
```

Grant the **notifications** permission on first launch, and exempt the app from
battery optimization for reliable always-on behaviour. A Gradle wrapper is not
committed — run `gradle wrapper` once (or open in Android Studio) to generate it.

## Out of scope (MVP)

- Play Store listing; transport controls (that's P1); forced screen-off via
  Device Owner (a later hardening path).
