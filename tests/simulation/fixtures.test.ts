import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { fixtureJson, generateFixture } from "../fixtures/generate.js";

describe("versioned auth fixture", () => {
  const fixturePath = fileURLToPath(new URL("../fixtures/v1.json", import.meta.url));

  it("is byte-identical to the deterministic seed generator", () => {
    expect(readFileSync(fixturePath, "utf8")).toBe(fixtureJson(generateFixture()));
  });

  it("contains no JSON number token for signed wide fields", () => {
    const parsed = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
    expect(parsed.fixtureVersion).toBe("AUTH-EIP712-AA-V3-V1/FIXTURES-1");
    expect(parsed.randomSeed).toBe("0x8aa3e712c0dec0de");
    expect(parsed.randomCaseCount).toBe(48);
    const message = JSON.stringify(parsed);
    expect(message).toContain('"18446744073709551615"');
    expect(message).toContain('"340282366920938463463374607431768211455"');
  });
});
