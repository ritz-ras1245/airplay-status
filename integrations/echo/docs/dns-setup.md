# DNS setup for Echo Show (`ECHO_DISPLAY_URL`)

Echo Show must resolve and reach airplay-status on your LAN. **Preferred URL:**

```
http://airplay-status.home.arpa:3003/echo
```

Set the same value in:

- Lambda env `ECHO_DISPLAY_URL` (SAM parameter)
- Skill/routine docs (for verification in Silk)

## eero limitation

eero **does not** expose custom static DNS records. Pick one option below and point eero **Advanced → DNS → Custom DNS** at the resolver you control.

| Option | Where | Summary |
|--------|-------|---------|
| **A — RPi** | Pi-hole or AdGuard Home on Raspberry Pi | Local rewrite `airplay-status.home.arpa` → LAN IP; eero custom DNS → Pi IP |
| **B — Synology** | Synology DNS Server or Docker AdGuard | Same rewrite; eero custom DNS → Synology IP |
| **C — Host dnsmasq** | macOS/Linux on airplay-status host | Local DNS on LAN IP; eero custom DNS → that IP |
| **D — Raw IP** | No DNS server — **default for dev/test** | `ECHO_DISPLAY_URL=http://192.168.x.x:3003/echo`; Mac runs `./bin/run-local.sh` |
| **E — mDNS** | Last resort | `http://<host>.local:3003/echo` — flaky on Echo; not MVP sign-off |

Also supported on networks with native local DNS: **OpenWrt**, **UniFi** local DNS records.

## Option D — dev/test (Mac)

1. Find Mac LAN IP: **System Settings → Network** or `ipconfig getifaddr en0`
2. Set `ECHO_DISPLAY_URL=http://192.168.x.x:3003/echo` in Lambda env
3. Run `./bin/run-local.sh` on the Mac
4. Echo Show must be on the **same Wi‑Fi**

`localhost` works on the Mac only — Echo cannot use it.

## Verify before routines

On Echo Show: **Silk** → navigate to `ECHO_DISPLAY_URL`

- Idle: “Nothing playing”
- With AirPlay: live metadata via SSE

## Beta (P49 Pi)

On RPi4 beta, use Pi LAN IP or a DNS rewrite to the Pi:

```
http://<pi-lan-ip>:3003/echo
```

Do not use `airplay-beta.local` from Echo unless mDNS (Option E) — prefer static IP or DNS rewrite.

## References

- [eero custom DNS](https://support.eero.com/hc/en-us/articles/360059988432-Setting-up-custom-DNS-servers-with-eero)
- [specs/p6-echo-show.md](../../../specs/p6-echo-show.md)
