#!/usr/bin/env python3
"""Collect every 00009 arm's compile + measurement record into one machine-checked table.

Reads only the raw runner logs under evidence/00009-circuit-weight/raw/, so every number in the
evidence markdown is traceable to a recorded run rather than retyped.
"""
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "evidence" / "00009-circuit-weight" / "raw"
VARIANTS = ROOT / "contracts" / "variants"
BASELINE_ROWS = 974572


def kv(text: str, key: str):
    m = re.search(rf"^{re.escape(key)}=(.*)$", text, re.M)
    return m.group(1).strip() if m else None


def collect(arm: str) -> dict:
    rec = {"arm": arm}
    cpath = RAW / f"{arm}.compile.log"
    mpath = RAW / f"{arm}.measure.log"

    if cpath.exists():
        c = cpath.read_text()
        rec["source"] = kv(c, "SOURCE")
        rec["source_sha256"] = kv(c, "SOURCE_SHA256")
        rec["compile_exit"] = kv(c, "COMPILE_EXIT")
        rec["compile_watchdog"] = kv(c, "WATCHDOG_TIMEOUT")
        rec["compile_key_files"] = kv(c, "KEY_FILES")
        rec["circuits"] = sorted(re.findall(r"^CIRCUIT=(.*)$", c, re.M))
        rt = re.search(r"^real (\S+)$", c, re.M)
        rec["compile_real_s"] = rt.group(1) if rt else None
        if rec["compile_exit"] != "0":
            # Capture the verbatim compiler error as this arm's verdict.
            body = c.split("IMAGE=", 1)[-1].split("\n", 1)[-1]
            rec["compile_error"] = body.split("real ", 1)[0].strip()

    if mpath.exists():
        m = mpath.read_text()
        rec["measure_exit"] = kv(m, "MEASURE_EXIT")
        rec["measure_watchdog"] = kv(m, "WATCHDOG_TIMEOUT")
        rec["measure_key_files"] = kv(m, "KEY_FILES")
        rec["zkir_bytes"] = kv(m, "ZKIR_BYTES")
        rec["zkir_sha256"] = kv(m, "ZKIR_SHA256")
        rec["bzkir_bytes"] = kv(m, "BZKIR_BYTES")
        rec["bzkir_sha256"] = kv(m, "BZKIR_SHA256")
        rec["marker_port"] = kv(m, "MARKER_PORT")
        r = re.search(r"\(k=(\d+), rows=(\d+)\)", m)
        if r:
            rec["k"] = int(r.group(1))
            rec["rows"] = int(r.group(2))
            rec["delta_rows"] = BASELINE_ROWS - rec["rows"]
            rec["pct_of_baseline"] = round(100.0 * rec["rows"] / BASELINE_ROWS, 2)
            rec["pct_saved"] = round(100.0 * rec["delta_rows"] / BASELINE_ROWS, 2)
        rt = re.search(r"^real (\S+)$", m, re.M)
        rec["measure_real_s"] = rt.group(1) if rt else None

    vpath = VARIANTS / f"{arm}.compact"
    if vpath.exists():
        rec["variant_sha256"] = hashlib.sha256(vpath.read_bytes()).hexdigest()
    return rec


def main(argv: list[str]) -> int:
    arms = argv or sorted({p.name.split(".")[0] for p in RAW.glob("*.log")})
    out = [collect(a) for a in arms]
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
