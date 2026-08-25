#!/usr/bin/env python3
"""00010 — mechanical comment stripper for the comment-rewrite verification gate.

Emits the CODE of a .compact source with every `//` line comment (including `///` doc
comments) removed, every blank line removed, and the remaining whitespace normalised
(leading/trailing whitespace stripped, internal runs of whitespace collapsed to one space).

String literals are respected: a `//` inside a double-quoted string is NOT a comment, so
frozen domain-separator bytes such as "aa:manager:owner:v1.0" can never be mangled by the
stripper. Compact has no block comments and this source contains none (asserted below).

usage: strip-comments.py <file.compact>
"""
import sys


def strip(src: str) -> str:
    out_lines = []
    for line in src.split("\n"):
        in_string = False
        escaped = False
        cut = len(line)
        i = 0
        while i < len(line):
            ch = line[i]
            if in_string:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_string = False
            else:
                if ch == '"':
                    in_string = True
                elif ch == "/" and i + 1 < len(line) and line[i + 1] == "/":
                    cut = i
                    break
                elif ch == "/" and i + 1 < len(line) and line[i + 1] == "*":
                    raise SystemExit("block comment found; this stripper does not handle them")
            i += 1
        code = line[:cut]
        code = " ".join(code.split())
        if code:
            out_lines.append(code)
    return "\n".join(out_lines) + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: strip-comments.py <file.compact>")
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        sys.stdout.write(strip(fh.read()))
