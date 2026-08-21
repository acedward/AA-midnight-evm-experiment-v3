# Compact compiler toolchain image — 00005-open-colour-custody (EXPERIMENTAL_LANE)
#
# REUSED VERBATIM from 00003 (@ a8ebff9) through 00004 (@ f066a09); the archive pin is asserted
# unchanged at both commits by scripts/lib/lane-pins.sh.
#
# LANE-DEV-1 (owner-approved 2026-08-17) — AND AS OF 2026-08-20 IT IS PROVEN RATHER THAN ARGUED.
#
# The spec pins `compactc-v0.33.0-rc.2`. When 00003 set this up that tag had NO PUBLISHED BINARY
# (`evidence/g1-lane/LANE.md` finding L-4), so the released `compactc-v0.33.0` was substituted and
# verified empirically — that substitution is what LANE-DEV-1 names.
#
# The upstream repository has since MOVED to `LFDT-Minokawa/compact`, and the old
# `midnightntwrk/compact` release URL now 404s (00006 finding F-316 — which is why this URL changed).
# The relocated release is tagged **`compactc-v0.33.0-rc.2`** — the tag the spec pins — and its asset
# hashes to `3aa23812…dc46`: BYTE-IDENTICAL to the `COMPACTC_SHA256` below, the digest 00003 recorded
# for the substituted v0.33.0 binary and every project since has re-asserted.
#
# So the deleted `v0.33.0` release was `rc.2` promoted unchanged, and every artifact this series has
# ever built was built with EXACTLY the pinned compiler. The deviation was never a deviation in
# substance, and that is now provable by digest instead of by reasoning.
#
# THIS IS NOT A RE-PIN. Identity is unchanged — same SHA-256, asserted by the same `sha256sum -c`
# below; only TRANSPORT moved. Owner decision Q2 -> A ("inherited lane, never re-pinned") is intact.
#
# The archive is pinned by SHA-256, so this build is reproducible and cannot silently drift.

FROM alpine:3.22

RUN apk add --no-cache libstdc++ libgcc unzip curl bash

ARG COMPACTC_URL=https://github.com/LFDT-Minokawa/compact/releases/download/compactc-v0.33.0-rc.2/compactc_v0.33.0-rc.2_aarch64-unknown-linux-musl.zip
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
