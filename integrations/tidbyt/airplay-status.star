"""AirPlay Status — Tidbyt now-playing (64×32, Spotify-style).

LOCKED LAYOUT — values below were tuned on-device (Jul 2026). Change with care.
"""

load("encoding/json.star", "json")
load("http.star", "http")
load("render.star", "render")

DEFAULT_BASE_URL = "http://localhost:3003"

# Colors
SPOTIFY_GREEN = "#1db954"
TITLE_COLOR = "#1db954"
ARTIST_COLOR = "#ffffff"
PAUSED_COLOR = "#888888"
TRACK_BG = "#333333"

# Typography
FONT = "tb-8"
STATUS_FONT = "tom-thumb"

# Layout (64×32 canvas, 32×32 art + 31px text column)
ART_SIZE = 32
TEXT_WIDTH = 30
TEXT_COLUMN_PAD_LEFT = 1
PROGRESS_HEIGHT = 3
PROGRESS_TOP_GAP = 2

# Playback status row — LOCKED
ICON_SIZE = 5              # play triangle height (5 rows); pause bar height
ICON_TEXT_GAP = 1          # gap between icon and "Playing" / "Paused"
PAUSE_BAR = 2              # pause bar width (|| ||)
PAUSE_GAP = 2              # gap between pause bars

# Play triangle rows (widths 1,2,3,2,1 — left-aligned, 3px max width)
PLAY_ROWS = [1, 2, 3, 2, 1]

def main(config):
    base_url = config.get("base_url") or DEFAULT_BASE_URL
    status = json.decode(config.get("status") or "{}")

    if status.get("clear") == True:
        return []

    title = status.get("title") or ""
    artist = status.get("artist") or ""
    album_art = status.get("albumArt") or ""
    progress_ms = status.get("progressMs") or 0
    duration_ms = status.get("durationMs") or 0
    is_playing = status.get("isPlaying") == True

    if not title and not artist:
        return []

    if album_art and not album_art.startswith("http"):
        album_art = base_url + album_art

    cover = fetch_cover(album_art)
    bar_color = SPOTIFY_GREEN if is_playing else PAUSED_COLOR

    return render.Root(
        delay = 80,
        child = render.Row(
            children = [
                cover,
                render.Padding(
                    pad = (TEXT_COLUMN_PAD_LEFT, 0, 0, 0),
                    child = render.Column(
                        expanded = True,
                        main_align = "center",
                        cross_align = "start",
                        children = [
                            render.Column(
                                children = [
                                    render.Marquee(
                                        width = TEXT_WIDTH,
                                        child = render.Text(title, color = TITLE_COLOR, font = FONT),
                                    ),
                                    render.Marquee(
                                        width = TEXT_WIDTH,
                                        child = render.Text(artist or "Unknown artist", color = ARTIST_COLOR, font = FONT),
                                    ),
                                    playback_status_row(is_playing),
                                    render.Box(height = PROGRESS_TOP_GAP),
                                    progress_bar(progress_ms, duration_ms, TEXT_WIDTH, bar_color),
                                ],
                            ),
                        ],
                    ),
                ),
            ],
        ),
    )

def playback_status_row(is_playing):
    label = "Playing" if is_playing else "Paused"
    color = SPOTIFY_GREEN if is_playing else PAUSED_COLOR
    icon = play_icon(SPOTIFY_GREEN) if is_playing else pause_icon(PAUSED_COLOR)
    return render.Row(
        cross_align = "center",
        children = [
            icon,
            render.Box(width = ICON_TEXT_GAP, height = 1),
            render.Text(label, font = STATUS_FONT, color = color),
        ],
    )

def pause_icon(color):
    return render.Row(
        children = [
            render.Box(width = PAUSE_BAR, height = ICON_SIZE, color = color),
            render.Box(width = PAUSE_GAP, height = ICON_SIZE),
            render.Box(width = PAUSE_BAR, height = ICON_SIZE, color = color),
        ],
    )

def play_icon(color):
    return render.Column(
        children = [play_row(w, color) for w in PLAY_ROWS],
    )

def play_row(width, color):
    return render.Row(
        children = [
            render.Box(width = width, height = 1, color = color),
        ],
    )

def progress_bar(progress_ms, duration_ms, width, fill_color):
    if duration_ms <= 0:
        return render.Box(width = width, height = PROGRESS_HEIGHT, color = TRACK_BG)

    pct = float(progress_ms) / float(duration_ms)
    if pct < 0:
        pct = 0
    if pct > 1:
        pct = 1

    filled = int(width * pct)
    if filled <= 0:
        return render.Box(width = width, height = PROGRESS_HEIGHT, color = TRACK_BG)
    if filled >= width:
        return render.Box(width = width, height = PROGRESS_HEIGHT, color = fill_color)

    return render.Row(
        children = [
            render.Box(width = filled, height = PROGRESS_HEIGHT, color = fill_color),
            render.Box(width = width - filled, height = PROGRESS_HEIGHT, color = TRACK_BG),
        ],
    )

def fetch_cover(url):
    if not url:
        return placeholder_cover()

    rep = http.get(url, ttl_seconds = 300)
    if rep.status_code != 200:
        return placeholder_cover()

    return render.Image(
        height = ART_SIZE,
        width = ART_SIZE,
        src = rep.body(),
    )

def placeholder_cover():
    return render.Box(
        width = ART_SIZE,
        height = ART_SIZE,
        color = "#333333",
        child = render.Text("♪", font = STATUS_FONT, color = "#666666"),
    )
