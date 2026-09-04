// GOLDEN VECTORS (project 00014, FR-013 / spec US4) — the pure oracles still return the same bytes.
//
// One assertion per frozen vector: run the exported pure circuit of whatever
// `contracts/**/*.compact` currently compiles to, over inputs defined in `lib/golden-vectors.ts`,
// and compare against `fixtures/00014-golden-vectors.json`, which was recorded from the PRE-SPLIT
// artifact. The split moves these circuits into `contracts/modules/`; nothing about that may move a
// byte, so a red row here is a real behaviour change and never something to re-record.
//
// The fixture is also compared as a SET, so a vector that silently disappears from the table fails
// just as loudly as one whose value moved.
//
// This file is deliberately small — see the header of `lib/golden-vectors.ts` for why (the KAT,
// MetaMask-differential and k=20 parity suites already pin most of these bytes; this is the belt
// that survives if the k=20 oracle is retired).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-ignore — generated artifact, present after compilation
import { pureCircuits as managerContractPure } from "../generated/manager/contract/index.js";
import {
  computeGoldenVectors,
  GV_ACCOUNT,
  GV_COLOUR_LOW,
  type GoldenOracles,
  type GoldenVector,
} from "../lib/golden-vectors.js";
import { bytesToHex } from "../lib/bytes.js";

const frozen = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/00014-golden-vectors.json", import.meta.url)), "utf8"),
) as { note: string; recordedFrom: string; vectors: GoldenVector[] };

const pure = managerContractPure as unknown as GoldenOracles;
const observed = computeGoldenVectors(pure);
const byId = new Map(observed.map((v) => [v.id, v]));

describe("golden vectors — the pure oracles are byte-identical to the pre-split artifact", () => {
  it("pins the same set of vectors the fixture froze", () => {
    expect(observed.map((v) => v.id)).toEqual(frozen.vectors.map((v) => v.id));
    expect(frozen.vectors.length).toBeGreaterThan(0);
  });

  for (const want of frozen.vectors) {
    it(`${want.oracle} — ${want.id}`, () => {
      const got = byId.get(want.id);
      expect(got, `no observed vector for ${want.id}`).toBeDefined();
      expect(got!.oracle).toBe(want.oracle);
      expect(got!.value).toBe(want.value);
    });
  }

  // Not a byte comparison but the property the two key vectors exist to demonstrate: one
  // (account, colour) pair addresses two DIFFERENT cells, one per family. If the split ever let the
  // two family tags collapse into one constant, every vector above could still match a re-recorded
  // fixture while this failed.
  it("keeps the two custody families under different keys for the same (account, colour)", () => {
    const shielded = bytesToHex(pure.shieldedKey(GV_ACCOUNT, GV_COLOUR_LOW));
    const unshielded = bytesToHex(pure.unshieldedKey(GV_ACCOUNT, GV_COLOUR_LOW));
    expect(shielded).not.toBe(unshielded);
  });
});
