package app.airplaystatus.alwayson

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Kiosk WebView host. Loads the airplay-status /display page and toggles
 * FLAG_KEEP_SCREEN_ON from the always-on state produced by PlaybackWatchService.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                this, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1,
            )
        }

        webView = findViewById(R.id.webview)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
        }
        webView.webViewClient = WebViewClient()
        webView.loadUrl(BuildConfig.DISPLAY_URL)

        startForegroundServiceCompat()
        observeState()
    }

    private fun startForegroundServiceCompat() {
        val intent = Intent(this, PlaybackWatchService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun observeState() {
        scope.launch {
            PlaybackRepository.state.collect { state ->
                if (shouldKeepScreenOn(state)) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
                // Tapping the resume notification brings us here; clear the nudge.
                if (state.nudge) {
                    PlaybackRepository.state.value = reduce(state, AlwaysOnEvent.DismissNudge)
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        PlaybackRepository.focused = true
    }

    override fun onStop() {
        super.onStop()
        PlaybackRepository.focused = false
        PlaybackRepository.state.value = reduce(PlaybackRepository.state.value, AlwaysOnEvent.FocusLost)
    }

    override fun onDestroy() {
        scope.cancel()
        webView.destroy()
        super.onDestroy()
    }
}
