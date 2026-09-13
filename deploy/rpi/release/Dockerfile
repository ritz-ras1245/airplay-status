# syntax=docker/dockerfile:1.7
# Mac/CI: linux/arm64 release artifact for a bare-metal Raspberry Pi.
#   ./bin/p49-build-release.sh
#
# Compile flags for nqptp + shairport-sync match deploy/rpi/install.sh
# (see shairport-configure-flags.txt / nqptp-configure-flags.txt).
# The Pi never compiles: it only apt-installs thin runtime debs.

ARG NQPTP_VERSION=1.2.4
ARG SHAIRPORT_VERSION=4.3.6
ARG PIXLET_VERSION=0.34.0
ARG RELEASE_TAG=dev
ARG GIT_COMMIT=unknown

# ---------------------------------------------------------------------------
# nqptp + shairport-sync (AirPlay 2 + pipe metadata)
# ---------------------------------------------------------------------------
FROM debian:trixie-slim AS sidecars
ARG NQPTP_VERSION
ARG SHAIRPORT_VERSION
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    autoconf \
    automake \
    libtool \
    pkg-config \
    git \
    curl \
    ca-certificates \
    file \
    binutils \
    libssl-dev \
    libavahi-client-dev \
    libsoxr-dev \
    libplist-dev \
    libsodium-dev \
    libgcrypt-dev \
    libconfig-dev \
    libpopt-dev \
    libasound2-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswresample-dev \
    libavfilter-dev \
    libtag1-dev \
    uuid-dev \
    libpulse-dev \
    libmbedtls-dev \
    libfftw3-dev \
    libuuid1 \
    xxd \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY deploy/rpi/release/shairport-configure-flags.txt /build/shairport-configure-flags.txt
COPY deploy/rpi/release/nqptp-configure-flags.txt /build/nqptp-configure-flags.txt
COPY deploy/rpi/release/generate-runtime-debs.sh /build/generate-runtime-debs.sh
COPY deploy/rpi/release/RUNTIME_DEBS.txt /build/RUNTIME_DEBS.txt

RUN git clone --depth 1 --branch "${NQPTP_VERSION}" https://github.com/mikebrady/nqptp.git /build/nqptp \
  && cd /build/nqptp \
  && autoreconf -fi \
  && ./configure $(grep -Ev '^\s*(#|$)' /build/nqptp-configure-flags.txt) \
  && make -j"$(nproc)" \
  && make install DESTDIR=/out

RUN git clone --depth 1 --branch "${SHAIRPORT_VERSION}" https://github.com/mikebrady/shairport-sync.git /build/shairport-sync \
  && cd /build/shairport-sync \
  && autoreconf -fi \
  && ./configure $(grep -Ev '^\s*(#|$)' /build/shairport-configure-flags.txt) \
  && make -j"$(nproc)" \
  && make install DESTDIR=/out

# Verify AP2 + pipe (same checks as the old on-Pi install.sh skip logic).
RUN set -e; \
    ver="$(/out/usr/local/bin/shairport-sync -V 2>&1 || true)"; \
    echo "$ver"; \
    echo "$ver" | grep -Eiq 'airplay.?2|airplay_2|airplay2'; \
    echo "$ver" | grep -iq 'pipe'

RUN chmod +x /build/generate-runtime-debs.sh \
  && /build/generate-runtime-debs.sh \
       /out/usr/local/bin/nqptp \
       /out/usr/local/bin/shairport-sync \
       > /out/RUNTIME_DEBS.ldd.txt \
  && echo "--- runtime debs ---" \
  && cat /out/RUNTIME_DEBS.ldd.txt

# ---------------------------------------------------------------------------
# Production node_modules for linux-arm64 (no npm on the Pi)
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS node-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# pixlet — download upstream linux_arm64 release (do not compile)
# ---------------------------------------------------------------------------
FROM debian:trixie-slim AS pixlet
ARG PIXLET_VERSION
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates tar \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /out
RUN archive="pixlet_${PIXLET_VERSION}_linux_arm64.tar.gz" \
  && curl -fsSL "https://github.com/tidbyt/pixlet/releases/download/v${PIXLET_VERSION}/${archive}" -o "/tmp/${archive}" \
  && tar -xzf "/tmp/${archive}" -C /out \
  && test -x /out/pixlet

# ---------------------------------------------------------------------------
# Pack tarball
# ---------------------------------------------------------------------------
FROM debian:trixie-slim AS pack
ARG RELEASE_TAG
ARG GIT_COMMIT
ARG NQPTP_VERSION
ARG SHAIRPORT_VERSION
ARG PIXLET_VERSION
ENV DEBIAN_FRONTEND=noninteractive \
    RELEASE_TAG=${RELEASE_TAG} \
    GIT_COMMIT=${GIT_COMMIT} \
    NQPTP_VERSION=${NQPTP_VERSION} \
    SHAIRPORT_VERSION=${SHAIRPORT_VERSION} \
    PIXLET_VERSION=${PIXLET_VERSION} \
    SIDECARS=/sidecars \
    APP=/app \
    RELEASE_SRC=/release-src \
    STAGE_DIR=/stage \
    OUT_DIR=/out

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    rsync \
    tar \
    coreutils \
    binutils \
  && rm -rf /var/lib/apt/lists/*

COPY --from=sidecars /out/usr/local/bin/nqptp /sidecars/nqptp
COPY --from=sidecars /out/usr/local/bin/shairport-sync /sidecars/shairport-sync
COPY --from=sidecars /out/RUNTIME_DEBS.ldd.txt /sidecars/RUNTIME_DEBS.ldd.txt
COPY --from=pixlet /out/pixlet /sidecars/pixlet
COPY --from=node-deps /app/node_modules /app/node_modules
COPY package.json package-lock.json /app/
COPY src /app/src
COPY config /app/config
COPY bin /app/bin
COPY integrations/tidbyt /app/integrations/tidbyt
COPY deploy/rpi/systemd /app/deploy/rpi/systemd
COPY deploy/rpi/release /release-src

RUN chmod +x /release-src/pack-release.sh /release-src/install-release.sh \
  && /release-src/pack-release.sh

FROM scratch AS export
COPY --from=pack /out/ /
