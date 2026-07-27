# Host bootstrap (nqptp + build deps)

Run **once on the Pi** before Docker compose — see [deploy/docker/README-WARN.md](../docker/README-WARN.md).

```bash
sudo ./deploy/rpi/install.sh
```

Installs nqptp, shairport-sync AP2 build deps, Avahi, Node 20. Does **not** replace Docker — it prepares the host for `./bin/p49-up.sh docker`.

Systemd units in `systemd/` are for hosts that run the app without containers; not used in the default Docker flow.
