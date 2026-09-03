# The pinned Compact toolchain: compiler 0.34.0, language 0.26.0, Compact runtime 0.19.0.
#
# THIS IS THE PROVENANCE RECORD FOR EVERY ARTIFACT IN THE REPOSITORY. The Manager's nine ZKIRs, its
# measured k, and the proving keys generated from it are all outputs of this exact compiler. The
# pin that matters is the RELEASE ARCHIVE by SHA-256 below: it is checked with `sha256sum -c`
# during the build, so the build cannot silently drift, and it is reproducible on any host from the
# upstream release page. A published image is only a cache of this archive; scripts/*.sh will use
# one when it is configured and fall back to building this file, verifying `compactc --version`
# and the two binary hashes either way.
#
# WHY 0.34.0. It is the official toolchain for Midnight ledger 9 (release `compactc-v0.34.0`,
# published 2026-08-25, marked Latest). Language 0.26.0 makes `Secp256k1Point`, `Secp256k1Base`,
# `Secp256k1Scalar`, `JubjubPoint` and `JubjubScalar` standard-library imports rather than
# built-ins, removes the std-lib `add`/`mul` circuits in favour of infix operators, makes
# `secp256k1EthereumAddress` assert a non-identity input, and fixes defects #588/#590/#608/#609/#704
# in the secp256k1 and hashing paths — so ZKIR bytes, and therefore keys, differ from 0.33.0.
#
# TRANSPORT MOVED ONCE, IDENTITY DID NOT. Upstream relocated from `midnightntwrk/compact` to
# `LFDT-Minokawa/compact` during the 0.33.0 era and the old release URLs now 404. Everything since
# is served from the LFDT-Minokawa release pages, which is where the archive below comes from.
#
# ARCHITECTURE. The pinned asset is `aarch64-unknown-linux-musl`, so THIS FILE BUILDS AN arm64
# IMAGE and the resulting binary runs on arm64 only. Upstream publishes an `x86_64` asset from the
# same release; building for x86_64 means switching both the URL and the SHA-256, which is a
# deliberate re-pin and would need its own verification that the outputs are identical. Until that
# is done, the toolchain is arm64.
#
# HISTORY (0.33.0, superseded 2026-09-03). The repository was previously pinned to compiler 0.33.0
# / language 0.25.0, built from `compactc-v0.33.0-rc.2`, asset
# `compactc_v0.33.0-rc.2_aarch64-unknown-linux-musl.zip`, archive SHA-256
# `3aa23812b0b086dbce07da3931a40dcb01bec9676b1ceed7f2d0be370ab2dc46`; the rebuilt toolchain's
# binaries hash to `compactc.bin`
# `2abdacfddf1b8ccc85ce6f4317b7a75b9f53641de6df0f387f86819084d10947` and `zkir-v3`
# `75153f473f8d1920fcbfc6c207e1038c9049bd0f17ae88c81367cd08c3522176`. That archive is still on the
# LFDT-Minokawa release page, so the 0.33.0 toolchain remains reproducible if an older artifact
# ever has to be rebuilt. The scripts also used to pin an image by digest
# (`aa00006-compactc@sha256:f57ca2d8…`) and CI a GHCR tag `ghcr.io/acedward/aa-compactc:0.33.0`;
# neither could be obtained — the first is a local tag no registry serves, the second returns
# "not found" — which is why the archive, not an image, is now the primary pin.

FROM alpine:3.22

RUN apk add --no-cache libstdc++ libgcc unzip curl bash

ARG COMPACTC_URL=https://github.com/LFDT-Minokawa/compact/releases/download/compactc-v0.34.0/compactc_v0.34.0_aarch64-unknown-linux-musl.zip
ARG COMPACTC_SHA256=d3e292c4f48e257dcd6b3d3e3e4743d7d8ea0729f48953eab91a366d44cd026d

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
