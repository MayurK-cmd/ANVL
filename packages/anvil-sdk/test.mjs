import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  slugify,
  toBaseUnits,
  toManifest,
  validateConfig,
} from "./index.js";

const valid = {
  name: "Scholar Search",
  description: "Search Google Scholar and return structured paper metadata",
  price: 0.01,
  devAddress: "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c",
  port: 8000,
  params: {
    query: { type: String, description: "Search query", required: true },
  },
};

describe("validateConfig", () => {
  it("accepts a minimal config", () => {
    const result = validateConfig(valid);
    assert.equal(result.ok, true, result.errors.join("; "));
  });

  it("rejects a missing price and devAddress", () => {
    const { ok, errors } = validateConfig({ ...valid, price: undefined, devAddress: undefined });
    assert.equal(ok, false);
    assert.equal(errors.length, 2);
  });

  it("rejects a non-address devAddress", () => {
    const { ok, errors } = validateConfig({ ...valid, devAddress: "alice.algo" });
    assert.equal(ok, false);
    assert.match(errors.join(), /20-byte address/);
  });

  it("rejects mainnet", () => {
    const { ok, errors } = validateConfig({ ...valid, network: "monad" });
    assert.equal(ok, false);
    assert.match(errors.join(), /only supported network/);
  });

  it("requires webcmd.command for browser agents", () => {
    const { ok, errors } = validateConfig({ ...valid, agentType: "browser" });
    assert.equal(ok, false);
    assert.match(errors.join(), /webcmd.command/);
  });

  it("requires an endpoint or a port", () => {
    const { ok } = validateConfig({ ...valid, port: undefined });
    assert.equal(ok, false);
  });

  it("rejects a param with no usable type", () => {
    const { ok, errors } = validateConfig({
      ...valid,
      params: { query: { type: Boolean, description: "nope" } },
    });
    assert.equal(ok, false);
    assert.match(errors.join(), /String or Number/);
  });
});

describe("toBaseUnits", () => {
  it("converts without floating point drift", () => {
    // 0.01 * 10**18 in float maths is 9999999999999998.
    assert.equal(toBaseUnits(0.01), "10000000000000000");
    assert.equal(toBaseUnits(1), "1000000000000000000");
    assert.equal(toBaseUnits(0.000001), "1000000000000");
  });

  it("rejects more precision than the token has", () => {
    assert.throws(() => toBaseUnits("0.1", 0), /decimal places/);
  });

  it("rejects nonsense", () => {
    assert.throws(() => toBaseUnits("free"), /non-negative decimal/);
  });
});

describe("toManifest", () => {
  it("derives id, endpoint and params", () => {
    const manifest = toManifest(valid);
    assert.equal(manifest.id, "scholar-search");
    assert.equal(manifest.endpoint, "http://localhost:8000/send");
    assert.equal(manifest.amount, "10000000000000000");
    assert.deepEqual(manifest.params, [
      {
        name: "query",
        type: "string",
        description: "Search query",
        required: true,
        example: "Search query",
      },
    ]);
  });

  it("keeps webcmd only for browser agents", () => {
    assert.equal(toManifest({ ...valid, webcmd: { command: "x" } }).webcmd, undefined);
    const browser = toManifest({
      ...valid,
      agentType: "browser",
      webcmd: { command: "scholar-search", sites: ["scholar.google.com"] },
    });
    assert.equal(browser.webcmd.command, "scholar-search");
    assert.equal(browser.webcmd.requiresAuth, false);
  });

  it("never carries env values, only key names", () => {
    const manifest = toManifest(valid);
    assert.deepEqual(manifest.envKeys, []);
    assert.equal(JSON.stringify(manifest).includes("secret"), false);
  });

  it("refuses to build a manifest from an invalid config", () => {
    assert.throws(() => toManifest({ ...valid, devAddress: "nope" }), /Invalid anvil.config/);
  });
});

describe("slugify", () => {
  it("makes store-safe ids", () => {
    assert.equal(slugify("Scholar Search v1"), "scholar-search-v1");
    assert.equal(slugify("  Price — Monitor  "), "price-monitor");
  });
});
