import { describe, expect, expectTypeOf, it } from "vitest";

import {
  AA_MINTER_SHIELDED_NAME,
  AA_MINTER_UNSHIELDED_NAME,
  OFFER_FILES_FAUCET_DECIMALS,
  aaMinterTokenMetadata,
  domainSepFromName,
  offerFilesRegistryTokenMetadata,
  offerFilesTokenColor,
  offerFilesTokenMetadata,
  validateTokenMetadata,
} from "../lib/token-metadata.js";
import { hex, MinterCollideSim, MinterSim, pad32 } from "../lib/sim.js";

const FIXED_OFFER_FILES_ADDRESS = "11".repeat(32);

// Frozen directly from the Offer Files faucet algorithm at kernel 4af1025. These are faucet
// names, never AA-Minter display names.
const OFFER_FILES_VECTORS = {
  WBTC: {
    separator: "ad7a77a29661df1a958938373c1bbd8596bc38a1c13653b6b24d8b5e09bd54f3",
    color: "fbb8258c1ecfb4720d06e51f205b0644924279651af093236a724ae1fcb3ea54",
  },
  WETH: {
    separator: "ad7a77a29661df1a958938373c1bbd859629c71d25620f2aae3967728df1b01f",
    color: "7df3e01d295a429094ee08a67f4187bc7ec3f355ba2c92d259c93467348129fb",
  },
} as const;

const INTERNAL_AA_TAGS = ["TOKA", "TOKB", "TOKC", "TOKD", "TOKE"] as const;
const OFFER_FILES_FAUCET_NAMES = ["WBTC", "WETH", "USDC", "ZTOKEN", "ATOKEN", "BTOKEN", "WUSD"] as const;

describe("canonical AA test-token metadata", () => {
  it("uses exact outward names and provenance while retaining the internal constructor tag", () => {
    const shielded = aaMinterTokenMetadata({
      family: "shielded",
      color: `0x${"12".repeat(32)}`,
      internalDeploymentTag: "TOKA",
    });
    const unshielded = aaMinterTokenMetadata({
      family: "unshielded",
      color: "34".repeat(32),
      internalDeploymentTag: "TOKA",
      decimals: 6,
    });

    expect(shielded).toEqual({
      name: AA_MINTER_SHIELDED_NAME,
      source: "aa-minter",
      family: "shielded",
      color: "12".repeat(32),
      internalDeploymentTag: "TOKA",
    });
    expect(unshielded).toEqual({
      name: AA_MINTER_UNSHIELDED_NAME,
      source: "aa-minter",
      family: "unshielded",
      color: "34".repeat(32),
      internalDeploymentTag: "TOKA",
      decimals: 6,
    });
    if (shielded.family === "shielded") {
      expectTypeOf(shielded.name).toEqualTypeOf<typeof AA_MINTER_SHIELDED_NAME>();
    }
    if (unshielded.family === "unshielded") {
      expectTypeOf(unshielded.name).toEqualTypeOf<typeof AA_MINTER_UNSHIELDED_NAME>();
    }
  });

  it("keeps uppercase Offer Files faucet names and source separate from AA metadata", () => {
    const faucet = offerFilesTokenMetadata({
      name: "WBTC",
      family: "shielded",
      offerFilesAddress: FIXED_OFFER_FILES_ADDRESS,
      decimals: OFFER_FILES_FAUCET_DECIMALS,
    });
    expect(faucet).toEqual({
      name: "WBTC",
      source: "offer-files-faucet",
      family: "shielded",
      color: OFFER_FILES_VECTORS.WBTC.color,
      decimals: 6,
    });
    expectTypeOf(faucet.internalDeploymentTag).toEqualTypeOf<undefined>();
  });

  it("refuses a market name or wrong AA family name on an AA-Minter colour", () => {
    // Negative control: Offer Files faucet names cannot label an AA-Minter colour.
    for (const name of ["WBTC", "weth", "WUSD", "AATEST-U"]) {
      expect(() => validateTokenMetadata({
        name,
        source: "aa-minter",
        family: "shielded",
        color: "12".repeat(32),
        internalDeploymentTag: "TOKA",
      })).toThrow();
    }
  });

  it("refuses malformed colours, lower-case faucet spellings and cross-source internal tags", () => {
    expect(() => aaMinterTokenMetadata({
      family: "shielded",
      color: "12",
      internalDeploymentTag: "TOKA",
    })).toThrow(/32 bytes/);
    expect(() => offerFilesTokenMetadata({
      name: "wBTC",
      family: "shielded",
      offerFilesAddress: FIXED_OFFER_FILES_ADDRESS,
      decimals: 6,
    })).toThrow(/uppercase/);
    expect(() => validateTokenMetadata({
      name: "WBTC",
      source: "offer-files-faucet",
      family: "shielded",
      color: "12".repeat(32),
      decimals: 6,
      internalDeploymentTag: "TOKA",
    })).toThrow(/unknown field/);
  });

  it("requires exactly six faucet decimals and rejects source-specific unknown fields", () => {
    expect(() => validateTokenMetadata({
      name: "WBTC",
      source: "offer-files-faucet",
      family: "shielded",
      color: OFFER_FILES_VECTORS.WBTC.color,
      decimals: 5,
    })).toThrow(/exactly 6/);
    expect(() => validateTokenMetadata({
      name: "AATEST-S",
      source: "aa-minter",
      family: "shielded",
      color: "12".repeat(32),
      internalDeploymentTag: "TOKA",
      offerFilesAddress: FIXED_OFFER_FILES_ADDRESS,
    })).toThrow(/unknown field/);
    expect(() => validateTokenMetadata({
      name: "WBTC",
      source: "offer-files-faucet",
      family: "shielded",
      color: OFFER_FILES_VECTORS.WBTC.color,
      decimals: 6,
      note: "unchecked registry data",
    })).toThrow(/unknown field/);
  });
});

describe("Offer Files faucet derivation", () => {
  it("matches the frozen WBTC and WETH FNV separator vectors", () => {
    for (const [name, vector] of Object.entries(OFFER_FILES_VECTORS)) {
      expect(hex(domainSepFromName(name)), `${name} separator`).toBe(vector.separator);
    }
  });

  it("matches frozen rawTokenType vectors at a fixed Offer Files contract address", () => {
    for (const [name, vector] of Object.entries(OFFER_FILES_VECTORS)) {
      expect(offerFilesTokenColor(name, FIXED_OFFER_FILES_ADDRESS), `${name} color`).toBe(vector.color);
    }
  });

  it("binds metadata to the Offer Files deployment and rejects a mismatched registry colour", () => {
    expect(offerFilesRegistryTokenMetadata({
      name: "WBTC",
      family: "shielded",
      offerFilesAddress: FIXED_OFFER_FILES_ADDRESS,
      registryColor: OFFER_FILES_VECTORS.WBTC.color,
      decimals: 6,
    }).color).toBe(OFFER_FILES_VECTORS.WBTC.color);
    expect(() => offerFilesRegistryTokenMetadata({
      name: "WBTC",
      family: "shielded",
      offerFilesAddress: FIXED_OFFER_FILES_ADDRESS,
      registryColor: OFFER_FILES_VECTORS.WETH.color,
      decimals: 6,
    })).toThrow(/does not match/);
  });
});

describe("AA internal separators versus Offer Files faucet separators", () => {
  it("keeps every shipped internal AA separator distinct from every faucet-name separator", async () => {
    const aaSeparators: string[] = [];
    for (const tag of INTERNAL_AA_TAGS) {
      const minter = await MinterSim.create(pad32(tag));
      aaSeparators.push(hex(minter.ledger.shieldedSep), hex(minter.ledger.unshieldedSep));
    }
    const collide = await MinterCollideSim.create(pad32("TOKX"));
    aaSeparators.push(hex(collide.ledger.collidingSep));
    const faucetSeparators = OFFER_FILES_FAUCET_NAMES.map((name) => hex(domainSepFromName(name)));

    expect(new Set(aaSeparators).size).toBe(11);
    expect(new Set(faucetSeparators).size).toBe(OFFER_FILES_FAUCET_NAMES.length);
    expect(new Set([...aaSeparators, ...faucetSeparators]).size).toBe(18);
  });

  it("keeps final colours distinct when the AA deployments and faucet use distinct addresses", async () => {
    const colors: string[] = [];
    for (const tag of INTERNAL_AA_TAGS) {
      const minter = await MinterSim.create(pad32(tag));
      colors.push(
        hex(await minter.call<Uint8Array>("shieldedColor")),
        hex(await minter.call<Uint8Array>("unshieldedColor")),
      );
    }
    const collide = await MinterCollideSim.create(pad32("TOKX"));
    colors.push(hex(await collide.call<Uint8Array>("collidingColor")));
    colors.push(...OFFER_FILES_FAUCET_NAMES.map((name) => offerFilesTokenColor(name, FIXED_OFFER_FILES_ADDRESS)));

    expect(colors).toHaveLength(18);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
