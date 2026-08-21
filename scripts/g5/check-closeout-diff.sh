#!/usr/bin/env bash
# Named, reproducible whitespace check for G5 code and structured reports.
# 00006 Plan 06 / audit F2. Verbatim raw .out/.log evidence is intentionally excluded and retained.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MODE=range
if [ "${1:-}" = "--cached" ]; then
  MODE=cached
  shift
fi
BASE="${1:-30780ff77bd760bfd84ce0606c1fa3e02e09382d}"
TARGET="${2:-HEAD}"

SCOPE=(
  harness/src/g5
  harness/src/test
  scripts/g5
  evidence/g5-mitigation
  evidence/g5-smoke
  ':(exclude,glob)evidence/g5-mitigation/**/*.out'
  ':(exclude,glob)evidence/g5-mitigation/**/*.log'
  ':(exclude,glob)evidence/g5-mitigation/**/*.offer'
  ':(exclude,glob)evidence/g5-mitigation/**/*.txt'
  ':(exclude,glob)evidence/g5-smoke/**/*.out'
  ':(exclude,glob)evidence/g5-smoke/**/*.log'
  ':(exclude,glob)evidence/g5-smoke/**/*.txt'
)

echo '[g5-closeout-diff] includes: harness/src/g5, harness/src/test, scripts/g5, structured g5 evidence'
echo '[g5-closeout-diff] excludes: verbatim raw evidence (*.out, *.log, *.offer, *.txt)'
if [ "$MODE" = cached ]; then
  echo "[g5-closeout-diff] command: git diff --cached --check ${BASE} -- <printed scope>"
  git diff --cached --check "$BASE" -- "${SCOPE[@]}"
else
  echo "[g5-closeout-diff] command: git diff --check ${BASE}..${TARGET} -- <printed scope>"
  git diff --check "${BASE}..${TARGET}" -- "${SCOPE[@]}"
fi
