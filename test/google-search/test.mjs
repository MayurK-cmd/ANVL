/**
 * Checks the parts that are not obviously correct: the query Google actually
 * receives, and the shape run() hands back. fetch is stubbed, so this costs no
 * API quota and needs no key.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { run } from "./src/index.mjs";

const realFetch = globalThis.fetch;
let lastUrl;

const stub = (body, ok = true, status = 200) => {
  globalThis.fetch = async (url) => {
    lastUrl = new URL(url);
    return { ok, status, json: async () => body };
  };
};

before(() => {
  process.env.GOOGLE_API_KEY = "test-key";
  process.env.GOOGLE_CSE_ID = "test-cx";
});
after(() => {
  globalThis.fetch = realFetch;
});

const SAMPLE = {
  searchInformation: { totalResults: "132000" },
  items: [
    {
      title: "Network Information | Monad Docs",
      link: "https://docs.monad.xyz/network",
      displayLink: "docs.monad.xyz",
      snippet: "Monad Testnet RPC endpoint",
    },
  ],
};

test("sends the query and flattens the results", async () => {
  stub(SAMPLE);
  const result = await run({ query: "  monad testnet rpc  " });

  assert.equal(lastUrl.searchParams.get("q"), "monad testnet rpc");
  assert.equal(lastUrl.searchParams.get("key"), "test-key");
  assert.equal(lastUrl.searchParams.get("cx"), "test-cx");
  assert.equal(lastUrl.searchParams.get("num"), "5");

  assert.equal(result.totalResults, 132000);
  assert.deepEqual(result.results, [
    {
      title: "Network Information | Monad Docs",
      url: "https://docs.monad.xyz/network",
      source: "docs.monad.xyz",
      snippet: "Monad Testnet RPC endpoint",
    },
  ]);
});

test("clamps count into Google's 1..10 window", async () => {
  stub(SAMPLE);
  await run({ query: "x", count: 99 });
  assert.equal(lastUrl.searchParams.get("num"), "10");
  await run({ query: "x", count: 0 });
  assert.equal(lastUrl.searchParams.get("num"), "5"); // 0 is falsy -> default
  await run({ query: "x", count: -3 });
  assert.equal(lastUrl.searchParams.get("num"), "1");
});

test("no results is empty, not a crash", async () => {
  stub({ searchInformation: { totalResults: "0" } });
  const result = await run({ query: "asdkjhasdkjh" });
  assert.deepEqual(result.results, []);
  assert.equal(result.totalResults, 0);
});

test("surfaces Google's error message", async () => {
  stub({ error: { message: "Daily Limit Exceeded" } }, false, 429);
  await assert.rejects(run({ query: "x" }), /429: Daily Limit Exceeded/);
});

test("requires a query", async () => {
  stub(SAMPLE);
  await assert.rejects(run({ query: "   " }), /query is required/);
});

test("requires credentials", async () => {
  stub(SAMPLE);
  const key = process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  await assert.rejects(run({ query: "x" }), /GOOGLE_API_KEY/);
  process.env.GOOGLE_API_KEY = key;
});
