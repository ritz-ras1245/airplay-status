package app.airplaystatus.alwayson

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Fetches /api/status from airplay-status (primary, then optional fallback).
 * Native HTTP so wake logic keeps working even when the WebView is asleep
 * (spec implementation step 2, OD4=A).
 */
class PlaybackPoller(
    private val statusUrl: String,
    private val fallbackUrl: String?,
    private val timeoutMs: Int = 4000,
) {
    fun fetch(): Playback? {
        for (base in listOfNotNull(statusUrl, fallbackUrl?.takeIf { it.isNotBlank() })) {
            try {
                return request("${base.trimEnd('/')}/api/status")
            } catch (_: Exception) {
                // try next base
            }
        }
        return null
    }

    private fun request(url: String): Playback {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            requestMethod = "GET"
        }
        try {
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(body)
            return Playback(
                isPlaying = json.optBoolean("isPlaying", false),
                title = json.optStringOrNull("title"),
                artist = json.optStringOrNull("artist"),
                album = json.optStringOrNull("album"),
                source = json.optStringOrNull("source"),
            )
        } finally {
            conn.disconnect()
        }
    }
}

private fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else optString(key, "").ifBlank { null }
