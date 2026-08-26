# Media Status

**Media Status** is the display brand for this dashboard when more than one playback source is enabled.

It is not a GitHub rename and not a new AirPlay speaker.

| Layer | Name |
|-------|------|
| Repo | `airplay-status` |
| AirPlay picker (virtual speaker) | **AirPlay Status** |
| Board (AirPlay + Spotify) | **Media Status** |
| Adapters | `airplay`, `spotify` |

## One by one

AirPlay (what the speakers are playing) and Spotify (what the Spotify account is playing) are different truths. The board shows **one card at a time**:

- Kiosk `/display` rotates among sources that have a track
- Dashboard `/` rotates the same way and has source pills to pin a source

`GET /api/status` is always the **focused** card, so Tidbyt, eInk, Echo, and P7–P9 keep working.

Specs: [p11-media-status-sources.md](../specs/p11-media-status-sources.md), [p12-spotify-source.md](../specs/p12-spotify-source.md).
