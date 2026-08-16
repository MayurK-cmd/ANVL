# Built so far

Status as of 2026-08-16, built during the Monad Blitz event. This is a factual log of what exists and works right now — not a roadmap.

---

## 1. Contracts (deployed on Monad Testnet, chain id `10143`)

| Contract | Address | What it does |
|---|---|---|
| AnvilToken | `0x538CDB64403a7b404270ce0a46EB6061107f5fb9` | `$ANVL` — ERC-20 + EIP-2612 permit, fixed 1B supply, no mint/pause/blocklist |
| AgentRegistry | `0x220120587F8ED2D224ABCaAA44688Ad272dD4a28` | On-chain agent listings: `owner`, `price`, `active` |
| StakingRevShare | `0xd867f3d9c1fce225316124b9bCA61C62FFF24eC8` | Stake/unstake/claim; `settle()` does permit + pull + 50/30/20 split atomically |
| IdentityRegistry | `0x65D579211248043b3C8Af705b0Ae4532a2F6188e` | ERC-8004 identity stand-in — ERC-721, `register()` mints an identity NFT |
| ReputationRegistry | `0x16C34D443bD3e794b14c74FfAF24f9BCa90Bc0be` | ERC-8004 reputation stand-in — deployed, wired nowhere yet, no feedback given |

Redeploy support: `contracts/script/Deploy.s.sol` takes a `DEPLOY_NONCE` env var folded into every CreateX salt, so redeploying against the same chain doesn't collide with the previous deployment's addresses (CreateX addresses are `hash(salt, initCode)` deterministic — an unchanged salt + unchanged bytecode reverts on redeploy otherwise).

`WorkflowRouter` (multi-agent chaining, from the original PRD) was never built — explicitly marked stretch scope, no contract file exists.

---

## 2. Payment layer (M402)

HTTP 402 → EIP-712 permit signature → verify → run agent → settle, all real:

- `src/lib/m402.ts` — isomorphic protocol: challenge encoding, EIP-712 domain/message construction, signature verification. No secrets, no RPC.
- `src/lib/facilitator.ts` — server-only. Builds the 402 challenge (reads the live permit nonce), and on settlement calls `StakingRevShare.settle(agentId, payer, amount, deadline, v, r, s)` — one atomic transaction: permit + pull + 50/30/20 split. (Originally did a naive two-step `permit()` + `transferFrom()` straight to the payTo address, bypassing the split entirely — fixed this session.)
- Dev mode (no `M402_TOKEN_ADDRESS`/`M402_PAY_TO`/`M402_FACILITATOR_KEY` set) still does real signature verification, just skips on-chain settlement and reports `settled: false` — never fakes a settlement.
- A payer only ever signs a typed message — zero MON needed to pay for an agent call. Only the facilitator (which submits the settlement tx) needs gas.

Verified live, repeatedly, with real on-chain `Distributed` events matching the expected 50/30/20 (30/0 falling to treasury when nobody's staked) math.

---

## 3. AgentRegistry wired into the app

`src/lib/registry.ts`'s `withOnChainData()` overlays live on-chain truth onto every agent object the app renders or charges against:

- `owner`, `amount` (price) — from `AgentRegistry.getAgent()`. Calling `updatePrice()`/`deactivate()` on-chain takes effect in the app immediately, no redeploy.
- `staked` — real total from `StakingRevShare.pools()`, formatted bigint-safe (not truncated to a whole number).
- `identityTokenId` — real ERC-8004 token id, verified live via `IdentityRegistry.ownerOf()` matching the current on-chain owner; fails closed (shows "Unverified identity") on any mismatch or missing registration.

Uploaded (non-fixture) agents can no longer self-report fake `staked`/`stakers`/`calls30d` in their manifest — those fields were removed entirely (or, for `staked`, now only ever populated by verified on-chain reads).

---

## 4. Four real agents

| Agent | Price | What it actually does |
|---|---|---|
| Echo Bench | 10000 wei | Fixture, by design — pure payment-plumbing test, no backend |
| Scholar Search | 30000 wei | Real `webcmd arxiv search` (PUBLIC API, no browser) |
| Price Monitor | 50000 wei | Real `webcmd amazon search` (stealth browser) + `webcmd flipkart search` (built from scratch this session — plain HTTP fetch of embedded search-page JSON, no browser needed), normalized via Claude, per-store failure isolation |
| Scholar Compare | 80000 wei | Real `webcmd arxiv search` + `webcmd arxiv paper` (abstracts) → Claude comparison (problem/approach/contribution/results/limitations per paper, key differences, synthesis) |

Notable fixes along the way:
- Found and fixed a real relevance bug in the `arxiv` plugin itself (private override at `~/.webcmd/clis/arxiv/search.js`): unquoted multi-word queries matched loosely on individual words (e.g. "zero knowledge proofs" surfaced knowledge-graph papers with zero cryptography relevance). Fixed by ANDing each word's own `all:` clause — correct for both exact-phrase and topic-style queries.
- Built the Flipkart adapter from scratch via the webcmd-adapter-author flow: verified, fixture-tested, site-memory recorded. Turned out more stable than Amazon (`PUBLIC`, no browser) since Flipkart's SSR search page embeds full product JSON directly in the HTML response.
- Both LLM calls are designed so the model can never hallucinate a number: it only ever returns indices back into data the app already has, plus prose — prices, titles, and URLs are never re-typed by the model.

---

## 5. LLM integration (`src/lib/llm.ts`)

Server-only. Claude API (`claude-opus-4-8`) via the Anthropic SDK, structured output via Zod schemas (`messages.parse()` + `zodOutputFormat()`). Two functions:
- `comparePapers(query, papers)` — Scholar Compare's analysis
- `normalizeListings(query, listings)` — Price Monitor's equivalent-product grouping + best-price pick

Both agents degrade gracefully if the LLM call fails (bad/missing key, rate limit, etc.) — Scholar Compare returns `status: "partial"` with the real retrieved papers and a clear error; Price Monitor falls back to "lowest listed price, no variant normalization" with a note explaining the degradation. Neither ever fabricates a result.

---

## 6. ERC-8004 identity — real, not fixture

All 4 agents are registered with real identity NFTs on `IdentityRegistry`:

| Agent | Token id |
|---|---|
| Echo Bench | 1 |
| Scholar Search | 2 |
| Price Monitor | 3 |
| Scholar Compare | 4 |

`/identity` page (`src/app/identity/page.tsx` + `src/lib/identity.ts` + `src/components/register-identity.tsx`):
- Read-only list of every registered identity — found by scanning token ids sequentially from 1 (complete, not a heuristic: `register()` always does `agentId = ++_lastId` with no burn function, so ids are dense with no gaps)
- A real self-register flow: connect wallet → submit a real `IdentityRegistry.register(agentURI)` transaction (needs testnet MON — this is a normal write, not a gasless M402 signature)
- Each agent's detail page links its "✅ ERC-8004 #N" badge to the matching row here

---

## 7. Staking UI (`/stake`)

`src/components/stake-panel.tsx` + additions to `src/lib/wallet.ts`. All real reads and writes against `StakingRevShare`:
- **Stake** — one signature (permit, free) + one transaction (`stakeWithPermit`, real gas) — saves a separate `approve()` step
- **Unstake** — returns principal + harvests pending reward in the same call
- **Claim** — harvests pending reward without touching principal
- Live reads: total staked per agent, your stake, your pending reward

Clearly labeled as a real gas-paying transaction throughout, unlike agent-call payments.

---

## 8. Mock/fake data removed

Audited and removed from the frontend:
- Fake `stakers` count and `calls30d` — unknowable without an indexer, previously hardcoded fixture numbers
- Fake `ownerIdentity` strings (now real, see §6)
- `staked` was fake, then real-but-truncated (bigint integer division dropped anything under 1 whole token), now real and precise via `formatToken()`

---

## 9. Notable bugs found and fixed this session

- Two pre-existing failing Solidity tests (field-order mismatch in `AgentRegistry.t.sol`; missing interface cast in `ERC8004.t.sol`) — contracts were fine, tests weren't
- CreateX address collision on redeploy → `DEPLOY_NONCE` fix (§1)
- `tsconfig.json` was type-checking `contracts/lib/`'s vendored dependencies once Foundry deps existed — excluded `contracts/`
- Turbopack tried to bundle `@agentrhq/webcmd`'s native dependency graph because its entry path was resolved via `require.resolve()` (a statically-traced reference) — switched to a raw filesystem read, invisible to the bundler
- A Windows **User-level** `ANTHROPIC_API_KEY=dummy` env var silently overrode the project's `.env` (Next.js never overrides an already-set `process.env` value) — removed
- RSC boundary violation: a Server Component tried to import `shortAddr`/`EXPLORER` from `wallet.ts`, which is `"use client"` — extracted the pure, DOM-free helpers into `src/lib/format.ts`
- Header `$ANVL`/MON balance could freeze permanently: `readBalances()`'s MON read had no error handling, so one transient RPC hiccup threw and got silently swallowed by the caller forever after — rewritten with `Promise.allSettled`, merges against previous state instead of blanking
- Public RPC rate limit (`15 req/sec`) — enabled Multicall3 batching (`batch: { multicall: true }`, confirmed live on Monad Testnet) on both the client-side and server-side read clients, collapsing bursts of concurrent `readContract()` calls into single requests

---

## What's explicitly not built

- `WorkflowRouter` / multi-agent chaining — no contract, no UI, stretch scope from the original PRD
- Reliance Digital, Croma (Price Monitor is Amazon + Flipkart only — deliberately scoped down; building a new store adapter from scratch is real, derisked-one-at-a-time work)
- `ReputationRegistry` — deployed, nothing calls `giveFeedback()` yet, no UI
- Real Webcmd "learn once, replay forever" sitemap memory — the arXiv/Amazon/Flipkart commands used here are pre-built adapters run fresh every call, not something taught interactively and cached
