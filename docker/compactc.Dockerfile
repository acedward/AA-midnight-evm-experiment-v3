# Compact compiler toolchain image — 00004-multi-token-custody (EXPERIMENTAL_LANE)
#
# REUSED VERBATIM from 00003 (@ a8ebff9); the archive pin is asserted unchanged by
# scripts/lib/lane-pins.sh.
#
# LANE-DEV-1 (owner-approved 2026-08-17): the spec pins `compactc-v0.33.0-rc.2`, but that tag has
# no published binary — GitHub has no release for it and the `compact` CLI installs only from
# releases (see evidence/g1-lane/LANE.md Finding L-4). The released `compactc-v0.33.0` is used
# instead and verified empirically. The pinned rc.2 source declares its own version as exactly
# `compiler 0.33.0` / `language 0.25.0` and pins ledger `9.1.0.0-rc.3` — this lane's ledger.
#
# The archive is pinned by SHA-256, so this build is reproducible and cannot silently drift.

FROM alpine:3.22

RUN apk add --no-cache libstdc++ libgcc unzip curl bash

ARG COMPACTC_URL=https://github.com/midnightntwrk/compact/releases/download/compactc-v0.33.0/compactc_v0.33.0_aarch64-unknown-linux-musl.zip
ARG COMPACTC_SHA256=3aa23812b0b086dbce07da3931a40dcb01bec9676b1ceed7f2d0be370ab2dc46

RUN set -eux; \
    curl -sSL -o /tmp/compactc.zip "$COMPACTC_URL"; \
    echo "${COMPACTC_SHA256}  /tmp/compactc.zip" | sha256sum -c -; \
    mkdir -p /opt/compactc; \
    unzip -q /tmp/compactc.zip -d /opt/compactc; \
    chmod +x /opt/compactc/compactc /opt/compactc/compactc.bin /opt/compactc/zkir \
             /opt/compactc/zkir-v3 /opt/compactc/fixup-compact /opt/compactc/format-compact; \
    rm -f /tmp/compactc.zip

ENV PATH="/opt/compactc:${PATH}"
WORKDIR /work
ENTRYPOINT []
CMD ["compactc", "--version"]
