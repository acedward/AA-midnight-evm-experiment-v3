# The pinned Compact toolchain: compiler 0.33.0, language 0.25.0.
#
# THIS IS THE PROVENANCE RECORD FOR EVERY ARTIFACT IN THE REPOSITORY. The Manager's nine ZKIRs, its
# measured k=19, and the proving keys generated from it are all outputs of this exact compiler. It
# is pinned twice over: the release archive by SHA-256 below (checked by `sha256sum -c` during the
# build, so the build cannot silently drift), and the resulting image by digest in scripts/*.sh.
#
# TRANSPORT MOVED ONCE, IDENTITY DID NOT. Upstream relocated from `midnightntwrk/compact` to
# `LFDT-Minokawa/compact` and the old release URL now 404s — which is the only reason the URL below
# changed. The relocated release is tagged `compactc-v0.33.0-rc.2` and its asset hashes to exactly
# the SHA-256 already recorded here, so the archive is byte-identical to the one every earlier
# artifact was built with. Nothing was re-pinned.
#
# ARCHITECTURE. The pinned asset is `aarch64-unknown-linux-musl`, so THIS FILE BUILDS AN arm64
# IMAGE and the resulting binary runs on arm64 only. Upstream publishes an `x86_64` asset from the
# same release; building for x86_64 means switching both the URL and the SHA-256, which is a
# deliberate re-pin and would need its own verification that the outputs are identical. Until that
# is done, the toolchain is arm64.
#
# HOW TO GET IT WITHOUT BUILDING. The published image is
#   ghcr.io/acedward/aa-compactc:0.33.0
# pinned by digest in scripts/compile.sh, and that is what CI pulls. Building this Dockerfile
# yourself should produce an equivalent toolchain; the digest-pinned image is what the recorded
# results were produced with.

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
