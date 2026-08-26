# Car Thing hardware notes (flash + pair)

The Spotify Car Thing ("Superbird") must be flashed to run the DeskThing client.
This project **does not** redistribute Spotify firmware or proprietary Car Thing
binaries — follow the community tooling below and obtain images from their
sources.

## References (verify current instructions at build time)

- **Thing Labs superbird-tool** — flashing toolkit: https://github.com/thinglabsoss/superbird-tool
- **Thing Labs wiki** — general Car Thing modding: https://github.com/thinglabsoss/wiki
- **DeskThing** — host server + client install: https://deskthing.app/

## Flow (summary)

1. Install the **DeskThing server** on a host on the same LAN (Mac/PC/NUC — OD4).
2. Flash the Car Thing per the Thing Labs superbird-tool instructions and install
   the DeskThing client image.
3. Pair the Car Thing to the DeskThing server.
4. Build this app (`npm run build`), zip `dist/`, load it in the DeskThing server,
   and initialize it onto the Car Thing.
5. Configure settings (`airplayStatusUrl`, optional `fallbackUrl`).

## Do not commit

- Spotify firmware images
- Proprietary Car Thing binaries / OTA blobs

Record the tested DeskThing + firmware versions in the PR acceptance notes (OD5).
