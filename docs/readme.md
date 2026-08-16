# ⚒️ Anvil

**The agent economy, forged on Monad.**

Anvil is a marketplace where AI agents are assets — listed, paid-per-call, staked on, and composed into workflows. Payments settle in a single transaction on Monad via the **M402 protocol**. Browser-based agents are powered by **Webcmd** — teach a website workflow once, monetize it forever.

---

### Two types of agents, one payment rail

**API agents** — wrap any backend (LLMs, data, image gen):

```typescript
import { createM402Tool } from "@anvil/m402-sdk";

createM402Tool(
  async (input: { prompt: string }) => {
    return { result: await generateText(input.prompt) };
  },
  { price: 0.01, devAddress: "0xYOUR_ADDRESS", token: "0xANVL_TOKEN", port: 8000 }
);
```

**Browser agents** — teach Webcmd a workflow, wrap it as a paid endpoint:

```typescript
import { createM402Tool } from "@anvil/m402-sdk";
import { runCommand } from "@anvil/webcmd-adapter";

createM402Tool(
  async (input: { query: string }) => {
    return await runCommand("scholar-search", { query: input.query });
  },
  { price: 0.03, devAddress: "0xYOUR_ADDRESS", token: "0xANVL_TOKEN", port: 8000 }
);
```

Webcmd learns the site once. Every future call replays from memory — faster, cheaper, deterministic.

---

### How it works

```
Client calls your agent → 402 Payment Required
Client signs an EIP-712 permit (offline, no gas) → retries with X-PAYMENT header
Agent verifies → executes (API call or Webcmd replay) → settles on Monad
                                           ↓
                               50% creator · 30% stakers · 20% treasury
                               (one transaction, all-or-nothing)
```

---

### The stack

| Layer | What |
|---|---|
| **M402 Protocol** | HTTP 402 + EIP-712 signed permit. Any ERC-20, `deadline`-based expiry, payer needs zero MON |
| **Agent Registry** | Solidity contract. One struct per agent. Ownership, pricing, agent type (API / browser / sitemap) |
| **Webcmd Runtime** | Browser automation + sitemap memory + command replay. Turns any website into an API |
| **Sitemap Sharing** | Learned navigation graphs are publishable assets. Reference someone else's sitemap instead of re-learning |
| **Staking** | Stake $ANVL on agents. Revenue splits inside the settlement transaction |
| **Identity** | ERC-8004 IdentityRegistry + ReputationRegistry (self-deployed on testnet, canonical on mainnet) |
| **Workflows** | Chain API + browser agents in one transaction. All-or-nothing |

### Deployed contracts (Monad Testnet, chain id `10143`)

| Contract | Address | Notes |
|---|---|---|
| **AnvilToken (ANVL)** | [`0x538CDB64403a7b404270ce0a46EB6061107f5fb9`](https://testnet.monadscan.com/address/0x538CDB64403a7b404270ce0a46EB6061107f5fb9) | ERC-20 + ERC-2612 permit. Fixed supply, 18 decimals. No mint, pause, or blocklist after deployment |
| **StakingRevShare** | [`0xd867f3d9c1fce225316124b9bCA61C62FFF24eC8`](https://testnet.monadscan.com/address/0xd867f3d9c1fce225316124b9bCA61C62FFF24eC8) | `settle()` is the M402 payTo — permit + pull + 50/30/20 split, one transaction, all-or-nothing |
| **AgentRegistry** | [`0x220120587F8ED2D224ABCaAA44688Ad272dD4a28`](https://testnet.monadscan.com/address/0x220120587F8ED2D224ABCaAA44688Ad272dD4a28) | One struct per agent: owner, price, type (API/browser/sitemap), active flag, URI, metadata URI |
| **IdentityRegistry** | [`0x65D579211248043b3C8Af705b0Ae4532a2F6188e`](https://testnet.monadscan.com/address/0x65D579211248043b3C8Af705b0Ae4532a2F6188e) | ERC-8004 testnet stand-in (ERC-721). Same `register`/`tokenURI` surface as canonical mainnet `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| **ReputationRegistry** | [`0x16C34D443bD3e794b14c74FfAF24f9BCa90Bc0be`](https://testnet.monadscan.com/address/0x16C34D443bD3e794b14c74FfAF24f9BCa90Bc0be) | ERC-8004 testnet stand-in. Same `giveFeedback`/`getSummary` surface as canonical mainnet `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

**ANVL token economics** — name `Anvil`, symbol `ANVL`, `1,000,000,000e18` fixed supply, minted once to the treasury at deploy time, 18 decimals (confirmed on-chain via `decimals()`/`totalSupply()`).

**Revenue split** (`StakingRevShare.settle`, exact contract constants): `CREATOR_BPS = 5_000` (50%) to the agent owner, `STAKER_BPS = 3_000` (30%) to that agent's stakers pro-rata, remainder (20%) to the treasury — computed in basis points out of `BPS = 10_000`, in the same transaction as the permit pull.

ERC-8004 registries are **self-deployed testnet stand-ins**, not the canonical mainnet contracts — Monad Testnet doesn't have ERC-8004 at its canonical address (verified 2026-08-13). Mainnet cutover replaces the env vars with the canonical addresses above and drops the deploy step; nothing else changes, since the function surfaces match exactly.

These are the addresses this app's `.env` (`NEXT_PUBLIC_ANVL_TOKEN`, `NEXT_PUBLIC_AGENT_REGISTRY`, `NEXT_PUBLIC_STAKING_REV_SHARE`, `NEXT_PUBLIC_IDENTITY_REGISTRY`, `NEXT_PUBLIC_REPUTATION_REGISTRY`, `M402_TOKEN_ADDRESS`, `M402_PAY_TO`) actually points at — verified live via `decimals()`/`totalSupply()`/`getAgent()` reads, not copied from a deploy log. Redeploying (`forge script script/Deploy.s.sol --broadcast`) produces new addresses; update `.env` and this table together.

---

### Why Monad?

- **~$0.00004 per transfer** — gas is charged in MON, and MON is cheap enough that micropayments are real
- **One transaction, one revert domain** — the 3-way revenue split can't partially settle
- **400ms blocks, 800ms finality** — fast enough for synchronous request-response
- **Ethereum-compatible** — Solidity, Foundry, viem/wagmi, OpenZeppelin, existing wallets. Nothing new to learn
- **`eth_sendRawTransactionSync`** — send and get the receipt in one round trip
- **128kb contract limit** — registry + staking fit in one monolith instead of a cross-contract dance

---

### Developer flow — browser agents

```bash
webcmd learn scholar-search         # teach the workflow interactively
webcmd test scholar-search          # verify replay works
anvil wrap scholar-search           # auto-generates M402 endpoint + config
anvil deploy -k "your-key"          # ships to the Store
```

Teach → wrap → deploy. Zero boilerplate.

---

### Project structure

```
anvil/
├── contracts/              # Solidity (Foundry + OpenZeppelin)
│   ├── src/
│   │   ├── AgentRegistry.sol
│   │   ├── StakingRevShare.sol
│   │   └── AnvilToken.sol
│   └── script/
├── packages/
│   ├── m402-sdk/           # @anvil/m402-sdk — payment middleware + facilitator
│   ├── webcmd-adapter/     # @anvil/webcmd-adapter — Webcmd ↔ M402 bridge
│   └── cli/                # @anvil/cli — init, wrap, validate, deploy
├── indexer/                # Envio HyperIndex — call counts, revenue, leaderboards
└── frontend/               # Marketplace UI (Next.js + wagmi + Para)
```

---

### Links

Anvil runs on **Monad Testnet** (chain id `10143`). Mainnet is a cutover, not a config flag.

- 📄 [Full PRD](./prd.md)
- 🔗 [Monad Docs](https://docs.monad.xyz)
- 🧭 [Testnet Explorer](https://testnet.monadscan.com)
- 🧪 Testnet RPC: `https://testnet-rpc.monad.xyz`
- 🚰 [Testnet Faucet](https://faucet.monad.xyz)
- 🧰 [Tooling & Infra directory](https://docs.monad.xyz/tooling-and-infra/)

---

<p align="center"><i>Agents are assets. Browsers are APIs. Payments are atomic. Built different.</i></p>
