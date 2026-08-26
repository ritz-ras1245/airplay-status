package app.airplaystatus.alwayson

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Foreground service that natively polls /api/status, runs the always-on state
 * machine, and posts the "Tap here to resume" notification when a focus-before-idle
 * session resumes. Screen-on is applied by MainActivity from PlaybackRepository.
 */
class PlaybackWatchService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var loop: Job? = null

    private val poller by lazy {
        PlaybackPoller(BuildConfig.STATUS_URL, BuildConfig.FALLBACK_URL)
    }

    private var idleSinceMs: Long = 0L
    private var lastMode: Mode = Mode.IDLE

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIF_ONGOING_ID, buildOngoingNotification())
        if (loop == null) loop = scope.launch { runLoop() }
        return START_STICKY
    }

    private suspend fun runLoop() {
        val graceMs = BuildConfig.IDLE_GRACE_SEC * 1000L
        val pollMs = BuildConfig.POLL_SEC * 1000L

        while (scope.isActive) {
            val pb = poller.fetch()
            PlaybackRepository.playback.value = pb

            var next = reduce(
                PlaybackRepository.state.value,
                AlwaysOnEvent.Playback(
                    isPlaying = pb?.isPlaying ?: false,
                    hasTitle = !pb?.title.isNullOrBlank(),
                ),
            )

            // Track idle grace based on wall-clock so WebView sleep can't stall it.
            if (next.mode == Mode.IDLE) {
                if (lastMode != Mode.IDLE) idleSinceMs = System.currentTimeMillis()
                if (idleSinceMs > 0 && System.currentTimeMillis() - idleSinceMs >= graceMs) {
                    next = reduce(next, AlwaysOnEvent.IdleGraceElapsed(focused = PlaybackRepository.focused))
                }
            } else {
                idleSinceMs = 0
            }
            lastMode = next.mode

            val prev = PlaybackRepository.state.value
            PlaybackRepository.state.value = next

            if (!prev.nudge && next.nudge) postResumeNudge()

            delay(pollMs)
        }
    }

    private fun channel(): String {
        val id = "airplay-status-alwayson"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (mgr.getNotificationChannel(id) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(id, "AirPlay Status", NotificationManager.IMPORTANCE_HIGH),
                )
            }
        }
        return id
    }

    private fun activityIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun buildOngoingNotification(): Notification =
        NotificationCompat.Builder(this, channel())
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.watching))
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setContentIntent(activityIntent())
            .build()

    private fun postResumeNudge() {
        val notif = NotificationCompat.Builder(this, channel())
            .setContentTitle(getString(R.string.resume_title))
            .setContentText(getString(R.string.resume_text))
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(activityIntent())
            .build()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIF_RESUME_ID, notif)
    }

    override fun onDestroy() {
        loop?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val NOTIF_ONGOING_ID = 1
        private const val NOTIF_RESUME_ID = 2
    }
}
