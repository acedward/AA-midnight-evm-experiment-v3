#!/usr/bin/env bash
#
# source-hash.sh — CONTENT HASHES OF THE COMPACT SOURCES, so a compile log says what was compiled.
#
# WHY THIS FILE EXISTS (project 00014, FR-015)
#   `compile.sh` and `keygen.sh` both log `SOURCE_SHA256` of `contracts/manager.compact`. That was
#   the whole contract until the modular split; it is now the PRESET only, and about four fifths of
#   the code that ends up in the artifact lives in `contracts/modules/*.compact`, which the compiler
#   sees because the whole `contracts/` directory is mounted. A log that hashes only the preset
#   would therefore claim provenance it does not have: every module could change and the recorded
#   hash would not move. `MODULES_TREE_SHA256` closes that gap, so the two hashes together cover
#   every byte compiled.
#
#   It lives in its own sourced file for the same reason `toolchain.sh` does: two copies of a hash
#   recipe drift, and two provenance logs that disagree are worse than none.
#
# THE RECIPE — deliberately simple enough to reproduce by hand:
#
#   the repo-relative PATH of each `contracts/modules/*.compact`, in C-locale sorted order, each
#   followed by a newline and then that file's exact bytes, concatenated, hashed once with SHA-256.
#
#   The path is part of the input, so renaming a module changes the hash even if no byte of code
#   does. Reproduce it from the repo root with:
#
#     ls contracts/modules/*.compact | LC_ALL=C sort \
#       | while read -r f; do printf '%s\n' "$f"; cat "$f"; done | shasum -a 256
#
#   `MODULES_TREE_SHA256=none` with `MODULES_TREE_FILES=0` means the compiled source directory has
#   no `modules/` in it at all — the case for the two minter targets and the frozen k=20 oracle,
#   which are single files and import nothing. It is not an error.
#
# usage: source it, then `modules_tree_sha256 <dir>` / `modules_tree_files <dir>` where <dir> is the
#        source directory handed to the compiler (the one mounted read-only at /work/src).

# modules_tree_sha256 <source-dir> — prints the hash, or `none` when <source-dir>/modules is absent.
modules_tree_sha256() {
  local src_dir="$1"
  [ -d "$src_dir/modules" ] || { printf 'none\n'; return 0; }
  local root
  root="$(cd "$src_dir/.." && pwd)"
  local base
  base="$(basename "$src_dir")"
  (
    cd "$root" || exit 1
    find "$base/modules" -maxdepth 1 -type f -name '*.compact' | LC_ALL=C sort | while read -r f; do
      printf '%s\n' "$f"
      cat "$f"
    done
  ) | shasum -a 256 | cut -d ' ' -f 1
}

# modules_tree_files <source-dir> — how many files went into that hash (0 when there is no modules/).
modules_tree_files() {
  local src_dir="$1"
  [ -d "$src_dir/modules" ] || { printf '0\n'; return 0; }
  find "$src_dir/modules" -maxdepth 1 -type f -name '*.compact' | wc -l | tr -d ' '
}
