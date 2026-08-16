# Anvil — AI Agent Marketplace on Monad

> **Anvil** is a marketplace where AI agents are assets — listed, monetized per-call, staked on, and composed into workflows. Payments settle in a single Monad transaction via the **M402 protocol**. Browser-based agents are powered by **Webcmd**, a learn-once-replay-cheap automation runtime that turns any website into a programmable API.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem & Solution](#2-problem--solution)
3. [Agent Types — API Agents & Browser Agents](#3-agent-types--api-agents--browser-agents)
4. [Webcmd — Browser Runtime for Agents](#4-webcmd--browser-runtime-for-agents)
5. [Agent Store](#5-agent-store)
6. [Agent Staking & Revenue Sharing](#6-agent-staking--revenue-sharing)
7. [Anvil Identity — ERC-8004](#7-anvil-identity--erc-8004)
8. [Composable Workflows](#8-composable-workflows)
9. [Curator Role & Incentives](#9-curator-role--incentives)
10. [$ANVL Token](#10-anvl-token)
11. [Architecture](#11-architecture)
12. [M402 Protocol — Monad Payment Protocol](#12-m402-protocol--monad-payment-protocol)
13. [SDK — `@anvil/m402-sdk`](#13-sdk--anvilm402-sdk)
14. [Webcmd Adapter — `@anvil/webcmd-adapter`](#14-webcmd-adapter--anvilwebcmd-adapter)
15. [CLI — `@anvil/cli`](#15-cli--anvilcli)
16. [Build Order & Implementation Plan](#16-build-order--implementation-plan)
17. [Open Design Questions](#17-open-design-questions)

---

## 1. Introduction

### What is Anvil?

Anvil is an AI agent marketplace built on Monad. It serves two classes of agents:

- **API agents** — wrappers around LLMs, data endpoints, image generators, or any HTTP service.
- **Browser agents** — powered by **Webcmd**, these agents navigate real websites, learn their workflows, and replay them as fast, cheap, deterministic commands.

Both agent types are discovered, invoked, and paid for through the same M402 micropayment protocol. Developers list agents on the Anvil Store, users pay per call, and revenue splits between creators, stakers, and the protocol treasury inside a single transaction.

The name "Anvil" reflects the project's purpose: it is the surface on which agents are forged, shaped, and hardened into production-grade economic assets.

### Key Features

- **AI Agent Chat** — an intelligent orchestrator that selects and invokes marketplace agents on your behalf.
- **Tool Marketplace** — browse, search, and test-drive M402-enabled agents (both API and browser-based).
- **Webcmd Integration** — teach a browser workflow once, package it as a paid agent. Sitemap memory means future runs are faster and cheaper.
- **Developer Payments** — automatic per-request micropayments in $ANVL, settled on Monad Testnet. (USDC isn't deployed on testnet, so it's a mainnet-era addition — the SDK's `token` field already accepts any ERC-20.)
- **Web3 Integration** — wallet connectivity via Para: embedded MPC wallets (email / phone / passkey / social) plus MetaMask, Coinbase, WalletConnect, Rainbow, Zerion, and Rabby. Monad Testnet / Mainnet.

### Why the Agent Economy?

AI is shifting from static tools into autonomous, task-oriented agents. But the most valuable work agents can do — research, price monitoring, lead generation, form filling, social posting, authenticated workflows — happens *inside browsers*, not behind APIs.

The gap:

- Developers lack ways to **monetize** agents, especially browser-based ones.
- Users struggle with **trust, discoverability, and credibility**.
- Browser automation is fragile, expensive, and non-reusable — every run re-learns the same site from scratch.
- The ecosystem has **no shared infrastructure** for coordination.

Anvil fills this gap by combining on-chain economics with Webcmd's learn-once-replay-cheap runtime, creating a marketplace where anything a human can do in a browser becomes a monetizable agent.

### Why Monad?

- **Sub-cent fees** — a native transfer costs about $0.00004 and a swap about $0.0011, so $0.001/call pricing tiers are viable at scale. Browser agents doing 50-step workflows with a $0.05 price point keep nearly all of it.
- **400ms blocks, 800ms finality** — fast enough for synchronous HTTP 402 request-response flows. Reversible UI actions land in 400ms, irreversible ones in 800ms.
- **One transaction, one revert domain** — the 50/30/20 revenue split executes inside the same call that moves the payment. Nothing partially settles.
- **`eth_sendRawTransactionSync`** — the facilitator submits and gets the receipt in a single RPC round trip, which is what makes settlement feel instant in the Playground.
- **Ethereum compatibility** — Solidity, Foundry, OpenZeppelin, viem/wagmi. No new language, no new wallet for users, no bespoke SDK for developers.
- **128kb contract size limit** — the registry, staking, and distribution logic fit in one monolith instead of a cross-contract dance with the coordination bugs that come with it.
- **ERC-8004** — Monad has canonical IdentityRegistry and ReputationRegistry deployments for AI agents on mainnet, so Anvil integrates a standard instead of inventing a naming system. On testnet we deploy the reference registries ourselves (§7) and swap two env vars at cutover.

### Mission & Vision

- **Mission**: Provide the infrastructure that transforms AI agents — both API-based and browser-based — into trusted, monetizable on-chain assets on Monad.
- **Vision**: A world where every agent is an asset, every website is an API, every creator has ownership, and the agent economy becomes a foundation of digital work — forged on the Anvil.

---

## 2. Problem & Solution

### The Problem

| Stakeholder | Pain |
|---|---|
| **Agent Developers** | Build powerful agents but have no distribution channel, no payment rail, no way to earn per-call revenue. Browser agents are especially hard to monetize — the automation code is fragile and the infra costs are high. |
| **Users** | Drowning in AI tools. No signal for quality. No way to know which agent is trustworthy. Browser-based tasks (research, shopping, data extraction) require technical setup that most users can't do. |
| **The Browser Gap** | Most valuable agent work happens on websites with no API. Every automation framework re-learns site navigation from scratch on every run — slow, expensive, brittle. There's no reusable "site knowledge" layer. |
| **Ecosystem** | Fragmented. Every agent is an island. No composability, no shared reputation, no coordination primitives. |

### The Solution — Anvil + Webcmd

| Layer | What Anvil Provides |
|---|---|
| **Monetization** | M402 protocol: HTTP 402 micropayments settled on Monad. Developers earn from call one. |
| **Browser Agents** | Webcmd runtime: learn a website's navigation once, store the sitemap in memory, replay as a deterministic command. Turns any website into a programmable, monetizable endpoint. |
| **Discovery & Trust** | Agent Store with on-chain staking signals. Stake = reputation = visibility. |
| **Composability** | Chain API agents and browser agents into multi-step workflows inside one transaction. |
| **Identity** | ERC-8004 IdentityRegistry — agent identity that other protocols can already read. |
| **Ownership** | Agents are registered on-chain. Webcmd command definitions (learned workflows) are stored as metadata — the developer's intellectual property. |
| **Shared Infrastructure** | Webcmd sitemaps (learned navigation graphs) are publishable, reusable assets. Developer A learns Amazon's navigation, Developer B's agent references it instead of re-learning. Sitemap creators earn fees. |

---

## 3. Agent Types — API Agents & Browser Agents

Anvil supports two first-class agent categories. Both use the same M402 payment flow, the same Store listing, the same staking mechanics.

### API Agents

Traditional agents that wrap an HTTP backend — LLM inference, data lookups, image generation, translation, code review.

```typescript
import { createM402Tool } from "@anvil/m402-sdk";

createM402Tool(
  async (input: { prompt: string }) => {
    return { result: await generateText(input.prompt) };
  },
  { price: 0.01, devAddress: "0xDEV...", token: "0xANVL...", port: 8000 }
);
```

These are the simpler category — the backend already exists, Anvil adds the payment and distribution layer.

### Browser Agents

Agents powered by **Webcmd** that navigate real websites, perform multi-step workflows, and return structured results. The developer teaches Webcmd the workflow interactively; Webcmd memorizes the site's structure and replays it deterministically on future invocations.

```typescript
import { createM402Tool } from "@anvil/m402-sdk";
import { runCommand } from "@anvil/webcmd-adapter";

createM402Tool(
  async (input: { query: string }) => {
    // Webcmd replays the learned "scholar-search" command
    // Uses sitemap memory — no re-learning, fast execution
    return await runCommand("scholar-search", { query: input.query });
  },
  { price: 0.03, devAddress: "0xDEV...", token: "0xANVL...", port: 8000 }
);
```

Browser agents are the higher-value, higher-moat category — they access data and perform actions that have no API equivalent.

### Why Both Matter

Without browser agents, Anvil is bounded by what APIs exist. With Webcmd, the addressable market expands from "things with APIs" to "everything on the internet." A developer can monetize any browser workflow — research, price comparison, social monitoring, authenticated tasks — by teaching it once and listing it on the Store.

---

## 4. Webcmd — Browser Runtime for Agents

### What is Webcmd?

Webcmd is a browser infrastructure tool for AI agents. It helps agents browse websites once, learn the site's navigation and workflows, and turn that knowledge into reusable commands so future runs are faster, cheaper, and more reliable.

It is not a scraper. It is an **agent browser automation framework plus a command-learning layer**.

### Architecture Layers

| Layer | Purpose |
|---|---|
| **Live Browser Control** | Headless or headed browser automation (Playwright/Puppeteer under the hood). Agents see and interact with real web pages. |
| **Sitemap Memory** | After navigating a site, Webcmd builds a persistent navigation graph — page relationships, form locations, interactive elements, auth flows. Stored as a structured JSON document. |
| **Command Registry** | Learned workflows are captured as deterministic command definitions — a sequence of actions tied to the sitemap. Commands are replayable without re-learning. |
| **CLI Authoring** | Developers teach workflows interactively via `webcmd learn <name>`, test via `webcmd test <name>`, and extend existing commands. |

### How Webcmd Fits Anvil

Webcmd's "learn once, replay cheap" pattern is a natural match for Anvil's "pay per call" model:

1. **Developer teaches** a workflow interactively: `webcmd learn google-scholar-search`
2. **Webcmd memorizes** the site's navigation graph and action sequence
3. **Developer packages** it as an Anvil agent: `anvil wrap google-scholar-search`
4. **Developer deploys**: `anvil deploy -k "key"`
5. **Users invoke** the agent via the Store, paying M402 micropayments per call
6. **Webcmd replays** the learned command — no re-learning, no wasted browser time

The learned command definition (sitemap + action sequence) is the developer's **intellectual property**, stored as the agent's `metadataURI` on IPFS or Arweave.

### Target Workflows

| Category | Examples |
|---|---|
| **Research** | Academic paper search, competitor analysis, market data aggregation |
| **Shopping** | Price comparison, deal monitoring, inventory tracking |
| **Social Platforms** | Content posting, engagement monitoring, audience analytics |
| **Authenticated Tasks** | Expense filing, order tracking, CRM updates, form submission |
| **Data Extraction** | Structured data from sites with no API — real estate listings, job boards, government records |

### Sitemap Sharing — Infrastructure as an Asset

Webcmd's sitemap memory layer creates a new class of marketplace asset: **shared sitemaps**.

- Developer A teaches Webcmd to navigate Amazon → publishes the sitemap to IPFS
- Developer B builds a price-comparison agent that *references* A's sitemap instead of re-learning Amazon from scratch
- Developer A earns a small referral fee every time their sitemap is used by another agent

This turns learned site knowledge into tradeable, composable infrastructure on the Anvil Store — not just agent outputs, but agent *inputs*.

Sitemaps are listed in the Store as a separate asset type with their own staking and revenue mechanics:

```
AgentRegistry entry:
  agentType:   SITEMAP
  agentId:     keccak256("amazon-nav-v2")
  owner:       0xALICE...
  price:       5000000000000000  (0.005 $ANVL per reference, 18 decimals)
  metadataURI: "ipfs://Qm.../amazon-sitemap.json"
```

---

## 5. Agent Store

The Anvil Store is where the agent economy comes alive — the marketplace for both API agents and browser agents.

### What It Is

A decentralized marketplace where:

- Developers **list agents** as M402-gated endpoints, backed by on-chain registry entries.
- Users **discover and test** agents directly — free tier or paid.
- Browser agents display their **Webcmd command type** (research, shopping, auth task, etc.) and **sitemap dependencies** so users know what sites the agent interacts with.
- Payments, staking, and curation happen natively in $ANVL.

### How It Works (On-Chain)

Every listed agent has an entry in the `AgentRegistry` contract:

```solidity
enum AgentType { API, BROWSER, SITEMAP }

struct Agent {
    address owner;         // creator, receives the 50% share
    uint96  price;         // price in token base units (packs with owner into one slot)
    string  uri;           // API endpoint URL
    string  metadataURI;   // IPFS/Arweave/HTTPS link to full metadata
    AgentType agentType;
    bool    active;
}

mapping(bytes32 agentId => Agent) public agents;   // agentId = keccak256(name)
```

Methods:
- `register(bytes32 agentId, string uri, uint96 price, string metadataURI, AgentType agentType)` — creates the entry. No minimum-balance deposit needed; the caller pays gas only.
- `updatePrice(bytes32 agentId, uint96 price)` — owner-only.
- `deactivate(bytes32 agentId)` — owner-only; sets `active = false`.

Metadata (description, tags, README, input/output schemas, Webcmd command definitions, sitemap references) lives off-chain at `metadataURI` to avoid burning gas on storage. This matters more on Monad than on Ethereum: a *cold* storage write costs 8,100 gas versus Ethereum's 2,100, and users pay for the gas limit rather than the gas used.

### Agent Metadata Schema

```json
{
  "name": "scholar-search-v1",
  "description": "Search Google Scholar and return structured paper metadata",
  "tags": ["research", "academic", "browser-agent"],
  "agent_type": "browser",
  "input_schema": { "query": "string" },
  "output_schema": { "papers": [{ "title": "string", "authors": "string[]", "year": "number", "url": "string" }] },
  "webcmd": {
    "command": "scholar-search",
    "sitemap_refs": ["ipfs://Qm.../google-scholar-sitemap.json"],
    "avg_execution_ms": 4200,
    "requires_auth": false
  }
}
```

The `webcmd` block is present only for browser agents and gives the marketplace UI enough information to display execution estimates, auth requirements, and sitemap dependencies.

### Why It Matters

- **For Developers**: Deploy an agent in minutes. Browser agents are especially powerful — teach Webcmd a workflow once and earn every time someone invokes it.
- **For Users**: Skip the noise. See agent types, execution stats, staking credibility, and community curation at a glance.
- **For the Ecosystem**: Shared sitemaps create a network effect — more site knowledge, more agents, more workflows, more value.

---

## 6. Agent Staking & Revenue Sharing

### The Problem

In a permissionless marketplace, anyone can deploy an agent. Quality signals are essential.

### The Answer: Staking

- Any wallet can **stake $ANVL on an agent** (API or browser) to boost its visibility.
- Staked amount = reputation score = Store ranking weight.
- When the agent generates revenue, **rewards split** between the creator and stakers.

### Revenue Split

| Recipient | Share |
|---|---|
| Agent Creator | 50% |
| Stakers (pro-rata) | 30% |
| Protocol Treasury | 20% |

For browser agents that reference **shared sitemaps**, a portion of the creator's 50% can optionally flow to the sitemap owner — configurable per agent (e.g. 45% creator / 5% sitemap owner / 30% stakers / 20% treasury).

### How It Works (On-Chain)

The `StakingRevShare` contract manages staking and distribution. It uses the standard accumulator (MasterChef) pattern rather than iterating stakers:

```solidity
struct Pool {
    uint256 totalStaked;
    uint256 accRewardPerShare;   // scaled by 1e18
}

struct Position {
    uint256 amount;
    uint256 rewardDebt;
}

mapping(bytes32 agentId => Pool) public pools;
mapping(bytes32 agentId => mapping(address staker => Position)) public positions;
```

**Methods:**

- `stake(bytes32 agentId, uint256 amount)` — `transferFrom` the staker, settle any pending rewards, update the position.
- `unstake(bytes32 agentId, uint256 amount)` — settle pending rewards, transfer the principal back.
- `claim(bytes32 agentId)` — pull accumulated rewards.
- `distribute(bytes32 agentId, uint256 amount)` — called by the M402 facilitator during settlement:
  - 50% → `agents[agentId].owner` (looked up from `AgentRegistry`)
  - 30% → `pool.accRewardPerShare += 30% * 1e18 / pool.totalStaked` — one storage write, no loop
  - 20% → treasury address (settable by governance)

Because the payment `transferFrom` and `distribute()` happen in the same transaction, either the whole split lands or the caller gets nothing — EVM revert semantics give atomicity for free.

**No staker cap.** `distribute()` is O(1) regardless of staker count, which is why the accumulator pattern is worth the extra bookkeeping: on Monad a loop over staker slots is a loop over *cold* storage reads at 8,100 gas each, and users pay for the gas limit they set, not the gas they use. A push-based split would put a hard ceiling on stakers per agent and charge every caller for it. Stakers pull rewards with `claim()`.

Edge case: if `pool.totalStaked == 0` at distribution time, the staker share routes to the treasury — otherwise it would be stranded in the contract.

### Why It Matters

- **Quality Discovery**: Staking signals confidence — especially important for browser agents where users can't easily preview the workflow.
- **Aligned Incentives**: Creators and stakers benefit together.
- **Accountability**: Bad agents lose stake, good agents compound reputation.

---

## 7. Anvil Identity — ERC-8004

### Identity Matters

In a marketplace with both API and browser agents, knowing the creator is crucial — especially for browser agents that interact with authenticated websites.

### What Anvil Uses

Anvil does not invent a naming system. It uses **ERC-8004**, the emerging standard for AI agent identity and reputation.

**On Monad Testnet you deploy the registries yourself.** The canonical ERC-8004 addresses exist on Monad *mainnet* only — verified 2026-08-13, both return empty bytecode on testnet:

```bash
# testnet (10143) — NO CODE at either address
cast code 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 --rpc-url https://testnet-rpc.monad.xyz  # → 0x
cast code 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 --rpc-url https://testnet-rpc.monad.xyz  # → 0x
```

(`.agents/skills/addresses/SKILL.md` lists these under "same addresses for Monad mainnet and testnet". That holds for mainnet; it does not currently hold for testnet. Re-check before assuming otherwise — testnet deployments land over time.)

So the testnet deploy script includes the ERC-8004 reference `IdentityRegistry` and `ReputationRegistry`, and their addresses go in `frontend/.env.local` alongside Anvil's own contracts. On the mainnet cutover, swap those two env vars for the canonical addresses below and delete the deployment step — nothing else in the app changes, because Anvil only ever talks to them through the standard interface:

| Contract | Monad Mainnet (cutover target) |
|---|---|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

Never hardcode either address in application code. Read both from env, on both networks.

How Anvil uses them:

- **Registration** — when a developer registers an agent, Anvil resolves their ERC-8004 identity and displays it on the Store listing.
- **Reputation** — feedback recorded in the ReputationRegistry is readable by any other protocol, so an agent's track record isn't locked inside Anvil.
- **Portability** — an agent identity registered through Anvil is usable by any other ERC-8004-aware marketplace, and vice versa.

### Why a Standard Instead of a Custom Namespace

- **Ownership**: Identity indicates who built and maintains an agent, in a registry Anvil doesn't control.
- **Trust**: Users trust browser agents from identities with on-chain reputation history — critical when agents interact with real websites on users' behalf.
- **Composability**: Reputation earned on Anvil travels with the agent.

Optional display layer: if a developer's address resolves under any Monad-ecosystem name service, the frontend shows the name instead of the hex address. Purely cosmetic — the registry entry is the source of truth.

---

## 8. Composable Workflows

One agent is powerful. API agents chained with browser agents is unstoppable.

### What It Is

- Users can **chain multiple agents** — mixing API and browser types — into a single workflow.
- Workflows are **public, forkable, and monetizable**.
- Each agent in the workflow earns fees when triggered.

### Example: Content Research Pipeline

```
1. [Browser Agent] scholar-search       → finds papers on a topic (Webcmd)
2. [Browser Agent] news-aggregator      → finds recent news coverage (Webcmd)
3. [API Agent]     summarizer           → synthesizes findings (LLM)
4. [API Agent]     blog-writer          → drafts a blog post (LLM)
5. [Browser Agent] wordpress-publisher  → posts to WordPress (Webcmd, authenticated)
```

Each agent earns per invocation. The workflow creator earns a small orchestration fee. All five payments settle in a single transaction.

### How It Works (On-Chain)

The `WorkflowRouter` contract (stretch goal):

```solidity
mapping(bytes32 workflowId => bytes32[] agentIds) public workflows;
```

- `createWorkflow(bytes32 workflowId, bytes32[] agentIds)` — registers a new workflow.
- `runWorkflow(bytes32 workflowId, bytes calldata input)` — loops the agent list, calling `distribute()` for each leg. One transaction: if any leg reverts, every payment unwinds.

Monad's 30M per-transaction gas limit gives this a lot of headroom — a five-agent workflow with five `distribute()` calls is comfortably inside it — but the loop should still be bounded (see Open Design Questions).

### Why Composability + Webcmd is Powerful

Browser agents unlock workflow steps that pure API agents can't reach. A workflow can start with browser-based research, pass through LLM processing, and end with browser-based publishing — all in one atomic execution with guaranteed payment to every contributor.

---

## 9. Curator Role & Incentives

### Who Are Curators?

Curators discover, evaluate, and bundle high-quality agents into themed collections. They are especially valuable for browser agents, where quality is harder to assess without testing.

### How Curators Earn

- Curators create **bundles** — curated lists organized by use case, domain, or quality tier.
- When users discover and invoke agents through a curator's bundle, the curator earns a share from the protocol's 20% treasury allocation.
- Curators can also bundle **sitemaps**, endorsing specific site-knowledge assets for reliability and coverage.

### Example

A curator specializing in e-commerce creates a "Price Intelligence Toolkit" bundle: an Amazon price tracker (browser agent), eBay listing monitor (browser agent), price comparison API (API agent), and deal alert notifier (API agent). Every invocation through the bundle earns the curator.

---

## 10. $ANVL Token

The **$ANVL token** powers transactions, staking, governance, and incentivization across the Anvil ecosystem.

### Token Implementation

$ANVL is an **ERC-20** built on OpenZeppelin — not written from scratch:

```solidity
contract AnvilToken is ERC20, ERC20Permit {
    constructor(address treasury)
        ERC20("Anvil", "ANVL")
        ERC20Permit("Anvil")
    {
        _mint(treasury, 1_000_000_000e18);   // fixed supply, minted once
    }
}
```

- **Decimals**: 18 (ERC-20 default; the SDK handles human-unit conversion)
- **`ERC20Permit` (EIP-2612)**: mandatory, not optional — it's what lets a payer authorize a transfer with a signature instead of a gas-paying `approve` transaction. The entire M402 flow depends on it.
- **Fixed supply**: minted at deployment, no `mint` function afterwards
- **No blocklist, no pause**: nothing that lets the deployer freeze a user's balance

### Token Utilities

| Utility | Description |
|---|---|
| **Agent Monetization** | Users pay $ANVL to invoke agents (API or browser). Revenue splits 50/30/20. |
| **Webcmd Sitemap Fees** | Agents referencing shared sitemaps pay a small $ANVL fee to the sitemap owner per invocation. |
| **Execution Fees** | Multi-agent workflows trigger small $ANVL fees per step. |
| **Staking & Reputation** | Stake $ANVL on agents or sitemaps to boost visibility. Stakers share in revenue pro-rata. |
| **Governance** | Token holders vote on fee structures, treasury allocations, and protocol upgrades. |
| **Premium Features** | Analytics dashboards, Webcmd execution logs, workflow insights. |

### Revenue Distribution

| Recipient | Share | Mechanism |
|---|---|---|
| Agent Creator | 50% | Direct `transfer` inside `distribute()` |
| Agent Stakers | 30% | `accRewardPerShare` bump — one storage write, pulled via `claim()` |
| Protocol Treasury | 20% | Direct `transfer` inside `distribute()` |

Flywheel: more agents → more staking → more usage → more revenue → stronger treasury → ecosystem grants → more agents (and more sitemaps).

---

## 11. Architecture

### System Overview

```
+-------------------+       HTTP 402 flow        +---------------------+
|      Client       | =========================> |   Agent API (Hono)  |
| (viem / Para)     | <========================= |   + m402Middleware   |
+--------+----------+   X-PAYMENT-REQUIRED       +----+----------+-----+
         |                                            |          |
         | signs EIP-712 permit                       |          |
         | (offline, zero gas, deadline-bound)        |          |
         |                                            |          |
         v                                            v          v
+--------------------------------------------------------------------------+
|                      Monad  (JSON-RPC + Envio indexer)                    |
|                                                                          |
|  +------------------+  +------------------------+  +------------------+  |
|  |  AgentRegistry   |  |  StakingRevShare       |  |  AnvilToken      |  |
|  |  (Solidity)      |  |  (Solidity)            |  |  ERC20 + Permit  |  |
|  |                  |  |                        |  |                  |  |
|  |  mapping:        |  |  mapping:              |  |  18 decimals     |  |
|  |  agentId ->      |  |  agentId -> Pool       |  |  fixed supply    |  |
|  |  { owner, uri,   |  |  (agentId, staker) ->  |  |  no pause        |  |
|  |    price, active,|  |  Position              |  |  no blocklist    |  |
|  |    agentType }   |  |                        |  +------------------+  |
|  +------------------+  |  distribute(): O(1)    |                        |
|         (may be deployed as one 128kb monolith) |                        |
+--------------------------------------------------------------------------+
         ^                                              ^
         |                                              |
    API Agents                                    Browser Agents
    (any HTTP backend)                            (Webcmd runtime)
                                                        |
                                           +------------+------------+
                                           |            |            |
                                        Live         Sitemap      Command
                                        Browser      Memory       Registry
                                        Control      (IPFS)       (metadata)
```

### Component Breakdown

**On-Chain (Solidity, Foundry, OpenZeppelin)**

| Contract | Purpose | Storage |
|---|---|---|
| `AnvilToken` | Ecosystem token | ERC-20 + ERC20Permit |
| `AgentRegistry` | Agent + sitemap listing, ownership, pricing, type | `mapping(bytes32 => Agent)` |
| `StakingRevShare` | Staking, O(1) revenue distribution | `mapping(bytes32 => Pool)`, `mapping(bytes32 => mapping(address => Position))` |
| `WorkflowRouter` (stretch) | Multi-agent workflow composition | `mapping(bytes32 => bytes32[])` |

Monad's 128kb contract size limit means `AgentRegistry` and `StakingRevShare` can ship as a single `Anvil.sol` if cross-contract lookups get annoying. Start split for readability; merge if the registry lookup inside `distribute()` shows up as a meaningful cold-`SLOAD` cost.

**Off-Chain**

| Component | Purpose | Tech |
|---|---|---|
| M402 Facilitator | Payment requirement generation, signature verification, settlement | TypeScript, viem, Hono middleware |
| Agent API Server | Hosts agent logic behind M402-gated endpoints | Hono (TypeScript) |
| Webcmd Runtime | Browser automation, sitemap memory, command replay | Webcmd (Playwright/Puppeteer, Node.js) |
| Webcmd Adapter | Wraps Webcmd commands as M402-compatible Hono handlers | `@anvil/webcmd-adapter` |
| Marketplace Frontend | Discovery, staking, wallet connectivity, agent type filtering | Next.js, wagmi v3, Para, shadcn/ui |
| Indexer | Call counts, revenue history, staking leaderboards, activity feed | Envio HyperIndex on Envio Cloud |
| Metadata Store | Agent descriptions, schemas, Webcmd command definitions, sitemaps | IPFS / Arweave / HTTPS |

### Key Monad / EVM Primitives

| Primitive | Where Used |
|---|---|
| **ERC-20** | $ANVL token (and any other ERC-20 a future payment token might be) |
| **EIP-2612 permit / Permit2** | Gasless payment authorization in M402 |
| **Contract storage** | Agent registry, staking positions, workflow definitions |
| **Single-transaction settlement** | 3-way revenue split — atomic by revert semantics |
| **`eth_sendRawTransactionSync`** | Facilitator settlement; receipt in one round trip |
| **ERC-8004** | Agent identity and reputation |
| **Envio HyperIndex** | Historical event queries the frontend can't get from an `eth_call` |

### Monad Behaviors the Implementation Must Respect

These differ from Ethereum and will bite if ignored:

| Behavior | Consequence for Anvil |
|---|---|
| **Gas is charged on the gas limit, not gas used** | Never let a wallet fall back to a max estimate. Set explicit limits on `stake`, `claim`, `register`, and `distribute`; document each function's cost. A native transfer is always 21,000 — hardcode it. |
| **Cold storage access costs 8,100 gas** (vs 2,100) | Pack `Agent` and `Position` structs into as few slots as possible. Never loop over stakers. |
| **`ecRecover` costs 6,000 gas** (2x Ethereum) | Permit-based settlement does signature recovery on-chain. It's still cheap in dollars, but it's a real line item in the `distribute()` gas limit. |
| **3-block delayed state view (async execution)** | A freshly funded wallet can't transact for ~1.2s. The onboarding flow must not fund a wallet and immediately prompt a transaction. |
| **10 MON reserve balance floor** | Accounts below 10 MON can send only one transaction per ~1.2s. Affects demo wallets and the facilitator hot wallet — keep the facilitator funded well above the floor. |
| **Block states: `latest` / `safe` / `finalized`** | The UI reads `latest` for optimistic updates at 400ms and confirms against `finalized` at 800ms before showing a payment as settled. |

---

## 12. M402 Protocol — Monad Payment Protocol

M402 is Anvil's adaptation of HTTP 402 for Monad. It works identically for API agents and browser agents — the payment flow is agnostic to what the agent does behind the middleware.

### How M402 Works

```
Client                          Agent API                         Monad
  |                                |                                |
  |  POST /send                    |                                |
  |  (no payment)                  |                                |
  |------------------------------->|                                |
  |                                |                                |
  |  HTTP 402                      |                                |
  |  X-PAYMENT-REQUIRED: {...}     |                                |
  |<-------------------------------|                                |
  |                                |                                |
  |  Client signs EIP-712 permit   |                                |
  |  offline — no gas, no tx       |                                |
  |                                |                                |
  |  POST /send                    |                                |
  |  X-PAYMENT: <base64 payload>   |                                |
  |------------------------------->|                                |
  |                                |                                |
  |                                |  verify(payload):              |
  |                                |    recover signer, check token,|
  |                                |    amount, spender, chainId,   |
  |                                |    nonce, deadline, balance    |
  |                                |------------------------------->|
  |                                |                                |
  |                                |  Execute agent function:       |
  |                                |    API agent: call backend     |
  |                                |    Browser agent: Webcmd replay|
  |                                |                                |
  |                                |  settle(payload):              |
  |                                |    ONE tx:                     |
  |                                |      permit(sig)               |
  |                                |      transferFrom(payer)       |
  |                                |      distribute() 50/30/20     |
  |                                |    eth_sendRawTransactionSync  |
  |                                |------------------------------->|
  |                                |    receipt in the same call    |
  |                                |<-------------------------------|
  |  200 OK                        |                                |
  |  { result: ... }               |                                |
  |<-------------------------------|                                |
```

The payer never submits a transaction and never needs MON. The facilitator pays gas — a sub-cent cost it recovers from the protocol's treasury share.

### Two Signature Schemes

| Scheme | When | How |
|---|---|---|
| `permit` (EIP-2612) | Paying in $ANVL, or any token that implements `ERC20Permit` | Client signs `Permit(owner,spender,value,nonce,deadline)`. Facilitator calls `token.permit(...)` then `transferFrom`. |
| `permit2` | Paying in a token without native permit support | Client signs a `PermitTransferFrom` for the canonical Permit2 contract. Requires a one-time `approve(Permit2, max)` per token. |

Default to `permit`. On testnet the payment token is $ANVL, which we deploy with `ERC20Permit`, so `permit2` should never be needed there — it exists for mainnet, where a payment token may be a bridged asset we don't control. The one-time approval is real UX friction and shouldn't be paid unless necessary.

Permit2 **is** live on Monad Testnet at the canonical address (verified 2026-08-13):

```bash
cast code 0x000000000022d473030f116ddee9f6b43ac78ba3 --rpc-url https://testnet-rpc.monad.xyz  # → bytecode
```

### Why the Payer Needs No MON

The payer signs an EIP-712 message and never broadcasts a transaction. The facilitator submits the settlement and pays gas — a sub-cent cost recovered from the treasury's 20% share.

That single property collapses the usual on-chain marketplace onboarding: no native-token balance, no funding step, no approval transaction, no waiting out the 3-block delay a freshly funded account is subject to (see §11). A brand-new user with a zero-balance wallet can pay for their first agent call. Signature-based payment is the design constraint everything else in M402 bends around — `deadline`, single-use nonces, and off-chain `verify` all exist to make it safe to accept a signature as payment before anything hits the chain.

### Payment Requirements Format

`X-PAYMENT-REQUIRED` response header (base64-encoded JSON):

```json
{
  "scheme": "permit",
  "chainId": 10143,
  "payTo": "0xSTAKING_REV_SHARE_CONTRACT",
  "token": "0xANVL_TOKEN_ADDRESS",
  "amount": "10000000000000000",
  "agentId": "0x<keccak256 of agent name>",
  "nonce": "7",
  "deadline": 1760000000,
  "description": "scholar-search — 1 query"
}
```

`amount` is a base-unit string (never a JS number — 18-decimal amounts overflow `Number.MAX_SAFE_INTEGER`). `nonce` is the token's current EIP-2612 nonce for the payer, read from the contract at requirement-generation time. `deadline` defaults to now + 120 seconds, which is generous at 400ms blocks.

---

## 13. SDK — `@anvil/m402-sdk`

The M402 SDK enables developers to monetize APIs and browser agents with per-request micropayments on Monad.

### Installation

```bash
npm install @anvil/m402-sdk
```

### Quick Start — API Agent

```typescript
import { createM402Tool } from "@anvil/m402-sdk";

createM402Tool(
  async (input: { prompt: string }) => {
    return { result: await generateText(input.prompt) };
  },
  {
    price: 0.01,
    devAddress: "0xYourDevAddress",
    token: "0xAnvlTokenAddress",
    port: 8000,
  }
);
```

### Quick Start — Browser Agent (with Webcmd)

```typescript
import { createM402Tool } from "@anvil/m402-sdk";
import { runCommand } from "@anvil/webcmd-adapter";

createM402Tool(
  async (input: { query: string }) => {
    return await runCommand("scholar-search", { query: input.query });
  },
  {
    price: 0.03,
    devAddress: "0xYourDevAddress",
    token: "0xAnvlTokenAddress",
    port: 8000,
    agentId: "scholar-search-v1",
  }
);
```

### Configuration

```typescript
interface M402Config {
  price: number;                              // human units (e.g. 0.01 = 0.01 $ANVL)
  devAddress: `0x${string}`;                  // creator address
  token: `0x${string}`;                       // ERC-20 payment token — $ANVL on testnet
  port?: number;                              // default 3000
  description?: string;
  network?: "monadTestnet";                   // default and only value in the MVP
  scheme?: "permit" | "permit2";              // default "permit"
  deadlineSeconds?: number;                   // signature validity window, default 120
  agentId?: string;                           // triggers StakingRevShare.distribute()
  gasLimit?: bigint;                          // explicit settlement gas limit — see note below
}
```

**On `gasLimit`:** Monad charges on the gas limit, not gas used. The SDK ships a measured default for `settle()` and only estimates when the call shape is unknown. If you override it, measure with `forge test --gas-report` rather than padding a guess — padding is money.

### API Reference

#### `createM402Tool`

```typescript
function createM402Tool<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
  config: M402Config
): Hono
```

Creates a payment-protected HTTP endpoint at `/send`.

#### `m402Middleware`

For custom Hono apps with mixed free/paid endpoints:

```typescript
import { Hono } from "hono";
import { m402Middleware } from "@anvil/m402-sdk";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));           // free
app.post("/basic", m402Middleware({ ...cfg, price: 0.01 }),    // $0.01
  async (c) => c.json({ tier: "basic" }));
app.post("/premium", m402Middleware({ ...cfg, price: 0.10 }),  // $0.10
  async (c) => c.json({ tier: "premium" }));
```

#### Facilitator (advanced)

```typescript
import { facilitator, verify, settle } from "@anvil/m402-sdk";

// Generate payment requirements (reads the payer's permit nonce from the token)
const requirements = await facilitator.generatePaymentRequirements({
  payTo, token, amount, agentId, description, payer,
});

// Verify a signed payment payload — pure signature + state checks, no tx
const result = await verify(paymentHeader, requirements);

// Submit permit + transferFrom + distribute in one tx, return the receipt
await settle(paymentHeader, requirements);
```

`verify` never submits anything. It recovers the signer from the EIP-712 signature, then checks token address, amount, spender, `chainId`, nonce, `deadline`, and the payer's balance against `latest`. Only after the agent function succeeds does `settle` broadcast.

### Client Integration

```typescript
import { createWalletClient, custom, parseUnits } from "viem";
import { monadTestnet } from "viem/chains";

async function callPaidAPI(url: string, input: unknown, account: `0x${string}`) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (res.status !== 402) return res.json();

  const req = JSON.parse(
    atob(res.headers.get("X-PAYMENT-REQUIRED")!)
  );

  const wallet = createWalletClient({ account, chain: monadTestnet, transport: custom(window.ethereum) });

  // Sign the permit — offline, no gas, no transaction
  const signature = await wallet.signTypedData({
    domain: { name: "Anvil", version: "1", chainId: req.chainId, verifyingContract: req.token },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: {
      owner: account,
      spender: req.payTo,
      value: BigInt(req.amount),
      nonce: BigInt(req.nonce),
      deadline: BigInt(req.deadline),
    },
  });

  const payment = btoa(JSON.stringify({ signature, payer: account, ...req }));

  return (await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PAYMENT": payment },
    body: JSON.stringify(input),
  })).json();
}
```

In the marketplace frontend this is wrapped by wagmi's `useSignTypedData`, and settlement uses `useSendTransactionSync` so the receipt arrives in the same call.

### Network Configuration — Monad Testnet

Anvil targets **Monad Testnet only**. There is no mainnet config path in the MVP; mainnet is a cutover, not a runtime toggle (see §17).

| Property | Value |
|---|---|
| Chain ID | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | `https://testnet.monadscan.com` |
| viem/wagmi chain | `monadTestnet` (from `viem/chains` / `wagmi/chains`) |
| Faucet | `https://faucet.monad.xyz` |
| Verification API | `https://agents.devnads.com/v1/verify` with `"chainId": 10143` |

### Addresses on Monad Testnet

Verified with `eth_getCode` against `https://testnet-rpc.monad.xyz` on 2026-08-13. Re-verify before you rely on any of them — testnet state changes, and a wrong address means lost funds.

| Contract | Address | On testnet? |
|---|---|---|
| CreateX (CREATE2 deploys) | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` | ✅ has code |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` | ✅ has code |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | ✅ has code |
| Foundry Deterministic Deployer | `0x4e59b44847b379578588920ca78fbf26c0b4956c` | ✅ has code |
| ERC-8004 IdentityRegistry | mainnet-only today | ❌ **deploy your own** (§7) |
| ERC-8004 ReputationRegistry | mainnet-only today | ❌ **deploy your own** (§7) |
| USDC | mainnet-only today | ❌ deploy a mock `ERC20Permit` for testing |
| WMON | mainnet-only today | ❌ not needed — gas is native MON |

**Anvil deploys on testnet:** `AnvilToken` ($ANVL), `AgentRegistry`, `StakingRevShare`, the two ERC-8004 reference registries, and optionally a mock USDC. Every one of those addresses lands in env vars — the app hardcodes none of them.

```bash
# how each row above was checked
cast code <address> --rpc-url https://testnet-rpc.monad.xyz
```

### Error Handling

| Status | Meaning | Fix |
|---|---|---|
| `402` | Payment required | Include a valid `X-PAYMENT` header |
| `402` + error body | Invalid payment | Check token, amount, spender, chainId, nonce, deadline |
| `500` | Server error | Check agent function / Webcmd command |

| Monad / EVM Error | Cause | Fix |
|---|---|---|
| `ERC2612ExpiredSignature` | `deadline` passed | Re-request fresh requirements |
| `ERC2612InvalidSigner` | Wrong domain, chainId, or nonce | Rebuild the EIP-712 domain from the live token contract |
| `ERC20InsufficientBalance` | Payer can't cover the amount | Surface the balance in the UI before signing |
| Nonce already used | Payload replayed | Nonces are single-use; request new requirements per call |
| Facilitator tx stuck / underpriced | Base fee moved | Monad's base fee decreases quickly; retry with a fresh fee estimate |
| New wallet's first tx rejected | Async execution's 3-block delayed state view | Wait ~1.2s after funding before the wallet's first transaction |

---

## 14. Webcmd Adapter — `@anvil/webcmd-adapter`

The adapter wraps Webcmd commands as M402-compatible async functions, bridging browser automation and the payment layer.

### Installation

```bash
npm install @anvil/webcmd-adapter
```

### Core API

#### `runCommand`

```typescript
async function runCommand<TInput, TOutput>(
  commandName: string,
  input: TInput,
  options?: WebcmdOptions
): Promise<TOutput>
```

Loads the named Webcmd command, replays it with the given input, and returns structured output.

| Parameter | Description |
|---|---|
| `commandName` | Name of the learned Webcmd command (e.g. `"scholar-search"`) |
| `input` | Input parameters the command accepts |
| `options` | Optional: browser launch config, sitemap overrides, timeout |

#### `WebcmdOptions`

```typescript
interface WebcmdOptions {
  headless?: boolean;           // default true in production
  sitemapUri?: string;          // override default sitemap with a shared one
  timeout?: number;             // max execution time in ms (default 30000)
  auth?: {
    provider: "vault" | "env";  // credential source for authenticated workflows
    credentialKey: string;      // lookup key
  };
}
```

### Usage with M402

```typescript
import { createM402Tool } from "@anvil/m402-sdk";
import { runCommand } from "@anvil/webcmd-adapter";

// Browser agent: price comparison across e-commerce sites
createM402Tool(
  async (input: { product: string }) => {
    return await runCommand("price-compare", {
      product: input.product,
    }, {
      sitemapUri: "ipfs://Qm.../ecommerce-bundle-sitemap.json",  // shared sitemap
      timeout: 45000,  // browser workflows can take longer
    });
  },
  {
    price: 0.05,
    devAddress: "0xDEV...",
    token: "0xANVL...",
    port: 8000,
    agentId: "price-compare-v1",
  }
);
```

Note the timing asymmetry: a browser workflow takes seconds, settlement takes 800ms. The agent function is the slow part, not the chain. Set `deadlineSeconds` comfortably above the command's `avg_execution_ms` so a long replay doesn't outlive its own payment signature.

### Sitemap Reference Resolution

When a command specifies `sitemapUri`, the adapter:

1. Fetches the sitemap from IPFS/Arweave/HTTPS
2. Injects it into Webcmd's memory layer (skipping the learning phase)
3. Replays the command actions against the pre-learned navigation graph
4. If the agent is configured with a sitemap `agentId`, settlement routes a micro-fee to the sitemap owner

### Authenticated Workflows

For browser agents that require login credentials:

```typescript
createM402Tool(
  async (input: { reportId: string }) => {
    return await runCommand("expense-report-fetch", {
      reportId: input.reportId,
    }, {
      auth: {
        provider: "vault",            // credentials from encrypted vault
        credentialKey: "concur-login" // per-user, never stored server-side
      },
    });
  },
  {
    price: 0.10,   // authenticated workflows are premium-priced
    devAddress: "0xDEV...",
    token: "0xANVL...",
    port: 8000,
    agentId: "expense-fetch-v1",
  }
);
```

Credentials are never stored on the Anvil platform. The adapter supports two models:
- **`vault`** — client provides an encrypted credential blob per request; adapter decrypts at runtime with a session key.
- **`env`** — developer manages their own credentials via environment variables (for agents they operate themselves).

---

## 15. CLI — `@anvil/cli`

Anvil CLI streamlines deployment for both API agents and browser agents.

### Installation

```bash
npm install -g @anvil/cli
```

### Commands

| Command | Status | Description |
|---|---|---|
| `anvil init <name>` | built | Scaffold a new agent project (API or browser) |
| `anvil validate` | built | Load and check `anvil.config.ts`, print the derived manifest |
| `anvil deploy -k <key>` | built | Validate, build the manifest, upload to the Anvil Store |
| `anvil deploy --dry-run` | built | Print exactly what would be uploaded, upload nothing |
| `anvil deploy -k <key> -v` | built | Verbose mode |
| `anvil --version` | built | Print CLI version |
| `anvil wrap <webcmd-command>` | **not built** | Needs the Webcmd runtime and `@anvil/webcmd-adapter` (phase 2). Exits with a message saying so rather than pretending |

Deploy uploads a manifest, not a zip: the agent runs on the developer's own
infrastructure and the Store stores a pointer to it.

### `anvil init` — API Agent

```bash
anvil init my-api-agent
```

Generates:
```
my-api-agent/
├── anvil.config.ts
├── README.md
├── .env
├── src/
│   └── index.ts          # createM402Tool boilerplate
└── package.json
```

### `anvil wrap` — Browser Agent (from Webcmd)

```bash
# Step 1: Teach Webcmd the workflow
webcmd learn scholar-search

# Step 2: Test the replay
webcmd test scholar-search

# Step 3: Wrap as an Anvil agent
anvil wrap scholar-search

# Step 4: Deploy
anvil deploy -k "your-key"
```

`anvil wrap` auto-generates:
- `anvil.config.ts` with `agentType: "browser"` and Webcmd command reference
- `src/index.ts` with `createM402Tool` + `runCommand` wiring
- `.env` template with `DEV_ADDRESS`, `TOKEN_ADDRESS`, Webcmd-specific vars
- Exports the Webcmd command definition to `commands/scholar-search.json`

Zero boilerplate. Teach → wrap → deploy.

### Configuration File

`anvil.config.ts` — owned and validated by **`@anvil/sdk`**:

```typescript
import type { AnvilConfig } from "@anvil/sdk";

const config: AnvilConfig = {
  name: "scholar-search-agent",
  description: "Search Google Scholar and return structured paper metadata",
  readmePath: "./README.md",
  env: "./.env",

  price: 0.03,                                           // whole $ANVL per call
  devAddress: "0xYourAddress",                           // receives the creator share

  params: {
    query: {
      type: String,
      description: "Search query for academic papers",
      required: true,
    },
  },

  port: 8000,                                            // or set `endpoint` directly
  network: "monadTestnet",
  agentType: "browser",                                  // "api" | "browser" | "sitemap"
  tags: ["Monad", "Research", "Browser Agent", "Webcmd"],

  // Browser agent specific
  webcmd: {
    command: "scholar-search",
    sitemapRefs: ["ipfs://Qm.../google-scholar-sitemap.json"],
    requiresAuth: false,
  },
};

export default config;
```

`import type` is erased before Node executes the file, so the config loads with
nothing installed — the SDK is needed for editor type-checking, never at runtime.
`defineConfig({ … })` is the equivalent value-import form.

### Configuration Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Project name. Source of the agent id unless `id` is set |
| `id` | `string` | No | Stable agent id. Defaults to a slug of `name` |
| `description` | `string` | Yes | Shown on the Store card |
| `price` | `number` | Yes | Whole $ANVL per call (e.g. `0.01`) |
| `devAddress` | `string` | Yes | Address receiving the creator share. Rejected if it's the zero address |
| `params` | `object` | Yes | Parameter definitions (`type`, `description`, `required`, `example`) |
| `port` | `number` | Yes* | Application port (1–65535). \*Required unless `endpoint` is set |
| `endpoint` | `string` | No | Absolute URL of the agent's M402 endpoint. Defaults to `http://localhost:{port}/send` |
| `readmePath` | `string` | No | README rendered on the agent page |
| `env` | `string` | No | Path to `.env`. Only KEY NAMES are read — never values |
| `token` | `string` | No | ERC-20 payment token address |
| `network` | `string` | No | `"monadTestnet"` — the only supported value; anything else is an error |
| `agentType` | `string` | No | `"api"` (default), `"browser"`, or `"sitemap"` |
| `tags` | `string[]` | No | Discovery tags |
| `purpose` | `string[]` | No | Bullets for the agent page's Purpose section |
| `webcmd` | `object` | No | Webcmd config (required if `agentType` is `"browser"`) |
| `webcmd.command` | `string` | — | Webcmd command name |
| `webcmd.sitemapRefs` | `string[]` | — | URIs of referenced sitemaps |
| `webcmd.requiresAuth` | `boolean` | — | Whether the workflow needs credentials |
| `webcmd.sites` | `string[]` | — | Sites the command touches, shown on the agent page |

### Upload protocol

`anvil deploy` turns the config into a manifest via `@anvil/sdk`'s `toManifest()`
and POSTs it to `POST /api/agents` on the Store with an `x-anvil-key` header.

- The Store refuses uploads with `503` unless `ANVIL_DEPLOY_KEY` is set — a
  route that writes to disk must not default open.
- The manifest is re-validated at the Store boundary. The SDK validates the
  developer's config for good error messages; the route re-checks the wire
  payload because HTTP input is untrusted, not a config file.
- Uploaded agents are persisted to `.anvil/agents.json` and merged over the
  built-in fixtures. **`ponytail:` a JSON file is the whole registry** — single
  node, not concurrent-safe, and exactly the seam where `AgentRegistry` on Monad
  replaces it.
- The Store playground calls the uploaded agent's `endpoint` **directly from the
  browser**. The marketplace is discovery, not a payment proxy — so an endpoint
  that answers `402` gets paid with no change on the Store side.

---

## 16. Build Order & Implementation Plan

Contracts ship before the frontend — the frontend needs deployed addresses, and guessing them wastes a day.

### Phase 1 — Core Protocol (Weeks 1–2)

| # | Component | Effort | Notes |
|---|---|---|---|
| 1 | `AnvilToken` (OZ `ERC20` + `ERC20Permit`) | 1 hr | Everything depends on the token existing. `ERC20Permit` is not optional — M402 needs it. |
| 2 | `StakingRevShare` contract | 1–2 days | Core IP — accumulator-based O(1) split. Demo centerpiece. |
| 3 | `AgentRegistry` contract | 0.5–1 day | With `agentType` for API/browser/sitemap. Pack the struct. |
| 4 | Deploy + verify on Testnet | 2–3 hr | CREATE2 via CreateX (`0xba5Ed…ba5Ed`, confirmed live on testnet), then the one-call verification API with `"chainId": 10143`. Same script deploys the two ERC-8004 reference registries — they don't exist on testnet (§7). Every resulting address goes to `.env`, none into source. |
| 5 | M402 facilitator: `generatePaymentRequirements`, `verify`, `settle` | 1–2 days | Test against Testnet with real signatures. Use `eth_sendRawTransactionSync`. |
| 6 | `createM402Tool` + `m402Middleware` | 0.5 day | Hono wrappers around the facilitator |

### Phase 2 — Webcmd Integration (Week 2–3)

| # | Component | Effort | Notes |
|---|---|---|---|
| 7 | `@anvil/webcmd-adapter` — `runCommand` wrapping Webcmd commands | 1–2 days | Bridge between Webcmd runtime and M402 endpoints |
| 8 | `anvil wrap` CLI command | 0.5–1 day | Auto-packages Webcmd commands for deploy |
| 9 | Sitemap metadata schema + IPFS upload in CLI | 0.5 day | Enables sitemap sharing |

### Phase 3 — Marketplace (Week 3–4)

| # | Component | Effort | Notes |
|---|---|---|---|
| 10 | Marketplace frontend | 1–2 days | Agent type filtering, call+pay flow, `useSendTransactionSync` |
| 11 | Para wallet integration | 0.5 day | `para init` + `ParaProvider`; patch in `monad`/`monadTestnet` from `wagmi/chains` |
| 12 | Envio HyperIndex indexer | 0.5–1 day | Call counts, revenue, staking leaderboards. After contracts are deployed *and verified*. |
| 13 | CLI scaffold (`anvil init` / `anvil deploy`) | 0.5–1 day | Config validation, zip, upload |
| 14 | ERC-8004 identity display | 0.5 day | Resolve creator identity in the Store UI |

### Phase 4 — Stretch Goals

| # | Component | Effort | Notes |
|---|---|---|---|
| 15 | `WorkflowRouter` contract | 1–2 days | Multi-agent chaining in one transaction |
| 16 | Sitemap sharing marketplace | 1 day | Browse/stake on sitemaps as assets |
| 17 | Authenticated browser agent support | 1–2 days | Vault-based credential injection in Webcmd adapter |

### Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity, Foundry, OpenZeppelin |
| Contract testing | `forge test` (+ `--gas-report`, since gas limits are what users pay) |
| Deployment | CREATE2 via CreateX (`0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed`), verified via `https://agents.devnads.com/v1/verify` |
| SDK | TypeScript, viem, Hono |
| Webcmd adapter | TypeScript, Webcmd runtime (Playwright/Puppeteer) |
| CLI | TypeScript, Bun-optimized (Node-compatible) |
| Frontend | Next.js, wagmi v3, Para, TailwindCSS, shadcn/ui |
| Indexing | Envio HyperIndex on Envio Cloud |
| Metadata storage | IPFS (Pinata / web3.storage) |
| CI/CD | Foundry + GitHub Actions |

### Repo Structure

```
anvil/
├── contracts/                        # Foundry project
│   ├── src/
│   │   ├── AnvilToken.sol
│   │   ├── AgentRegistry.sol
│   │   ├── StakingRevShare.sol
│   │   └── WorkflowRouter.sol        # stretch
│   ├── test/
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
├── packages/
│   ├── anvil-sdk/                    # @anvil/sdk — BUILT. Owns anvil.config.ts
│   │   ├── index.js                  #   defineConfig, validateConfig, toManifest, loadConfig
│   │   ├── index.d.ts                #   the schema of record
│   │   ├── test.mjs
│   │   └── package.json              #   no build step: plain ESM + hand-written types
│   ├── cli/                          # @anvil/cli — BUILT. init / validate / deploy
│   │   ├── anvil.mjs                 #   bin, node:util parseArgs — no CLI framework
│   │   ├── commands/{init,validate,deploy}.mjs
│   │   ├── templates.mjs
│   │   ├── test.mjs
│   │   └── package.json
│   ├── m402-sdk/                     # @anvil/m402-sdk — not extracted yet;
│   │   ├── src/                      #   lives in the app at src/lib/m402.ts
│   │   │   ├── facilitator.ts
│   │   │   ├── middleware.ts
│   │   │   ├── createTool.ts
│   │   │   ├── verify.ts
│   │   │   ├── settle.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── webcmd-adapter/               # @anvil/webcmd-adapter
│   │   ├── src/
│   │   │   ├── runCommand.ts
│   │   │   ├── sitemapResolver.ts
│   │   │   ├── authProvider.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── cli/                          # @anvil/cli
│       ├── src/
│       │   ├── init.ts
│       │   ├── wrap.ts               # webcmd → anvil agent generator
│       │   ├── deploy.ts
│       │   └── validate.ts
│       ├── package.json
│       └── tsconfig.json
├── indexer/                          # Envio HyperIndex
├── frontend/                         # Marketplace UI
│   ├── src/app/
│   ├── src/components/
│   └── package.json
├── .monskills
├── CLAUDE.md
├── README.md
└── package.json                      # Workspace root (pnpm/bun)
```

### `CLAUDE.md`

```markdown
# CLAUDE.md — Anvil

## Identity
You are building Anvil, an AI agent marketplace on Monad with Webcmd browser agent support.

## Operations
- `build:contracts` — `cd contracts && forge build`
- `build:sdk` — `cd packages/m402-sdk && bun run build`
- `build:adapter` — `cd packages/webcmd-adapter && bun run build`
- `build:cli` — `cd packages/cli && bun run build`
- `test:contracts` — `cd contracts && forge test --gas-report`
- `test:sdk` — `cd packages/m402-sdk && bun test`
- `test:adapter` — `cd packages/webcmd-adapter && bun test`
- `deploy:testnet` — `cd contracts && forge script script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz`

## Constraints
- Smart contracts: Solidity, Foundry, OpenZeppelin — never rewrite ERC-20 from scratch
- SDK: TypeScript, viem v2+, Hono v4+
- Revenue split happens in the same tx as the payment transfer — never a separate settlement step
- StakingRevShare uses the accumulator pattern — never loop over stakers (cold SLOAD is 8,100 gas on Monad)
- Gas is charged on the gas limit, not gas used — set explicit limits, measure with --gas-report
- $ANVL: ERC20 + ERC20Permit, 18 decimals, fixed supply, no pause, no blocklist
- Network default: Monad Testnet (chain id 10143, https://testnet-rpc.monad.xyz)
- Verify every contract post-deploy via https://agents.devnads.com/v1/verify
- Never hardcode an address without confirming it with `cast code`
- AgentRegistry agentType enum: 0=API, 1=BROWSER, 2=SITEMAP
- Webcmd adapter: runCommand is the only bridge between Webcmd and M402
- Sitemap URIs: IPFS preferred, HTTPS acceptable for MVP
- Credentials for auth workflows: never stored server-side

## File conventions
- Contracts: `contracts/src/{Name}.sol`, tests in `contracts/test/{Name}.t.sol`
- SDK source: `packages/m402-sdk/src/`
- Adapter source: `packages/webcmd-adapter/src/`
- CLI source: `packages/cli/src/`
- Tests next to source: `*.test.ts`
```

---

## 17. Open Design Questions

1. **Who pays settlement gas?** The facilitator does, so the payer needs zero MON — that's the point. It's sub-cent per call, recovered from the treasury's 20%. Open question: at what call volume does the facilitator hot wallet need automated top-ups, and what's the alert threshold? Note the 10 MON reserve floor — a facilitator that drops below it gets rate-limited to one tx per ~1.2s.

2. **Payment token** — $ANVL only. It isn't really a choice on testnet: USDC has no testnet deployment, and $ANVL is a token we deploy, so we can guarantee it has `ERC20Permit` and the whole gasless flow works. A stablecoin payment option is a mainnet-era question, and it arrives with the Permit2 approval friction attached. The `token` config field already accepts any ERC-20 at runtime.

3. **Facilitator hosting model** — same-process for MVP. Extractable to a separate facilitator service later.

4. **Registry as monolith or split?** Monad's 128kb limit allows `AgentRegistry` + `StakingRevShare` in one contract, avoiding a cross-contract cold `SLOAD` inside `distribute()`. Start split for readability, measure the gas report, merge if it matters.

5. **Webcmd execution cost model** — browser agents are more expensive to run than API agents (headless browser overhead). Should pricing recommendations differ? Should the Store display estimated execution time from Webcmd metadata?

6. **Sitemap freshness** — websites change. How often should sitemaps be re-learned? Options: (a) sitemap owners manually re-learn and re-publish, (b) agents detect navigation failures at runtime and trigger a re-learn, (c) periodic re-validation jobs. Recommend (a) for MVP with (b) as a fast-follow.

7. **Sitemap revenue model** — when Agent B references Agent A's sitemap, how does the micro-fee flow? Options: (a) deducted from Agent B's 50% creator share, (b) a fourth transfer in `distribute()`. Recommend (a) — same gas, no extra cold storage read.

8. **Authenticated workflow trust** — users must trust browser agents with credentials for authenticated tasks. Options: (a) enhanced staking requirements for auth agents, (b) mandatory code audit badge, (c) sandboxed execution with credential isolation. All three are roadmap items; for MVP, auth agents are clearly labeled and caveat-emptor.

9. **Workflow loop bound** — `runWorkflow` loops `distribute()` per agent. Monad's 30M per-tx gas limit is generous, but the loop still needs a hard cap so a malicious workflow can't be built to always exceed it. What's the max chain length — 10? 20? Measure and pick.

10. **Agent metadata storage** — IPFS (content-addressed, permanent) vs HTTPS (mutable, simpler). IPFS for sitemaps and Webcmd command definitions (immutability matters). HTTPS acceptable for agent descriptions (mutability is fine).

11. **Optimistic UI vs finality** — payment confirmation can be shown against `latest` at 400ms or `finalized` at 800ms. 400ms feels better; 800ms is honest. Proposal: show "settled" optimistically at `latest`, and only surface a correction in the rare case the block doesn't become canonical.

12. **What the mainnet cutover actually costs** — the MVP is testnet-only by design, with no mainnet code path. The known cutover work: redeploy Anvil's four contracts, point the two ERC-8004 env vars at the canonical mainnet registries instead of our own deployment (§7), re-run the indexer against mainnet from block zero, and swap `monadTestnet` for `monad` in the Para/wagmi config. Open question is $ANVL itself — a testnet token minted to a dev treasury isn't a mainnet token, and its real distribution is a decision nobody has made yet.

---

*Agents are assets. Browsers are APIs. Payments are atomic. Forged on the Anvil.*
