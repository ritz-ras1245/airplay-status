# Tidbyt layout — locked (device-tuned)

Do not change casually; re-verify on a physical Tidbyt after edits.

## Playback status row

```
[play ▶ or pause ⏸][1px gap]["Playing" | "Paused"]
```

| Constant | Value | Notes |
|----------|-------|--------|
| `ICON_TEXT_GAP` | 1 | Space between icon and label |
| `ICON_SIZE` | 5 | Play triangle height; pause bar height |
| `PAUSE_BAR` | 2 | Pause bar width (`\|\|` `\|\|`) |
| `PAUSE_GAP` | 2 | Gap between pause bars |
| `STATUS_FONT` | `tom-thumb` | Label font |

### Play icon (green `#1db954`, 3px max width)

```
#
##
###
##
#
```

Rows: `PLAY_ROWS = [1, 2, 3, 2, 1]` — no trailing padding on each row.

### Pause icon (grey `#888888`, 6px wide)

```
 ##  ##
 ##  ##
 ##  ##
 ##  ##
 ##  ##
```

2×5 bars, 2px gap between.

## Text column

| Constant | Value |
|----------|-------|
| `TEXT_WIDTH` | 30 |
| `TEXT_COLUMN_PAD_LEFT` | 1 |
| `PROGRESS_TOP_GAP` | 2 | Gap below status row, above progress bar |
| `PROGRESS_HEIGHT` | 3 |

## Preview

```bash
STATUS='{"title":"Preview","artist":"Test","isPlaying":true,"progressMs":30000,"durationMs":180000}'
pixlet render integrations/tidbyt/airplay-status.star \
  "status=${STATUS}" base_url=http://localhost:3003 \
  -o /tmp/tidbyt-preview.webp
open /tmp/tidbyt-preview.webp
```
