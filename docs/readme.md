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
