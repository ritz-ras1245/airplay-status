# Fire TV Stick (secondary — manual Silk)

Fire TV Stick has Silk but **OpenURL APL from Alexa routines may not apply** the same way as Echo Show. P6 treats Fire TV as **secondary** — manual bookmark path only.

## Manual path

1. Resolve `ECHO_DISPLAY_URL` on your LAN (see [dns-setup.md](dns-setup.md))
2. On Fire TV: open **Silk Browser**
3. Bookmark `http://<host>:3003/echo` (or your DNS name)
4. Open bookmark when you want the dashboard

The `/echo` page includes TV-safe CSS at `@media (min-width: 1280px)`.

## Tier B limitation

Automatic routine → OpenURL is **not** a merge blocker for P6 if Echo Show 5/8 passes. Fire TV users rely on manual Silk until a dedicated flow is spec'd.

## Optional profile

No separate Fire TV query param in P6 — responsive layout uses min-width breakpoints in `src/public/css/echo.css`.
