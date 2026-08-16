# Anvil — UI Flow

> Derived from the Axicov product UI. The guiding principle is the same: **it should feel like browsing an app store, not using a DeFi protocol.** Wallet, chain, contracts, tokens — all of that is infrastructure the user never thinks about. They see agents, they click run, they get results.

Monad makes that principle easier to hold than most chains: 400ms blocks and `eth_sendRawTransactionSync` mean a paid call returns in roughly the time a normal API call would, and the M402 payment is a signature rather than a transaction the user has to fund. There is no "connect, fund, approve, then use" ramp before the first run.

**Network: Monad Testnet (10143).** The app is single-network — it never asks the user to pick a chain. One place in the UI acknowledges testnet at all: a small `Testnet` chip beside the wordmark in the sidebar, which links to [faucet.monad.xyz](https://faucet.monad.xyz). Balances, prices, and the token symbol read exactly as they will on mainnet, so nothing about the layout has to change at cutover.

---

## Global Shell

Every page shares the same shell. Two pieces: a sidebar and a top bar.

### Sidebar (left, always visible)

```
┌──────────────────────┐
│  ⚒️  Anvil  [Testnet] │
│                      │
│  ◇ Add workflow      │  ← primary CTA, accent-colored
│                      │
│  MAIN MENU           │
│  🏠 Store             │
│  🔗 Workflows        │
│  🏷️ Identity         │
│  💰 Stake            │
│                      │
│                      │
│                      │
│  💬 AI Assistant  ●   │  ← bottom-pinned, dot = online
└──────────────────────┘
```

Notes:
- "Workflows", "Identity", "Stake" show `Coming Soon` badges during MVP — same as Axicov does.
- **Dev Dashboard and My Agents are not in the sidebar.** Both are developer surfaces, and the sidebar is the buyer's surface — a marketplace shouldn't open on tools for the handful of people who publish to it. Page 4 stays specified for when there's something to manage; route to it directly (`/dashboard`) until then.
- AI Assistant opens a slide-over chat panel (not a new page). The assistant can search the Store, invoke agents, and explain results conversationally.
- Sidebar collapses to icon-only on narrow viewports.

### Top bar (right-aligned)

```
┌───────────────────────────────────────────────────┐
│                      💰 0.000 ANVL  🟢 0x1a2b…9F4c │
└───────────────────────────────────────────────────┘
```

- Token balance ($ANVL) replaces Axicov's "EDU" display.
- Wallet address truncated, colored dot = connected (green) / disconnected (gray).
- Clicking the wallet chip opens a dropdown: switch account, disconnect, view on testnet.monadscan.com, copy address.
- Wallet connection via **Para** — one modal covering embedded MPC wallets (email, phone, passkey, Google/Apple/Twitter/Discord/Farcaster) and external wallets (MetaMask, Coinbase, WalletConnect, Rainbow, Zerion, Rabby). Most Store visitors will never install an extension.
- Network chip appears **only** when the connected chain isn't Monad Testnet (`10143`) — it reads `Wrong network · Switch` and calls `useSwitchChain`. On the happy path the user never sees a chain name.
- Staking and claiming need MON for gas. If the balance is zero and the user reaches for a gas-paying action, the error state links to [faucet.monad.xyz](https://faucet.monad.xyz) rather than just failing. Running an agent needs no MON at all, so this never blocks a first run.

---

## Page 1 — Store (Agent Grid)

**Route:** `/store`

This is the landing page. A grid of agent cards. Nothing else competes for attention.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  🏠 Store                                          [⊞]  │
│                                                         │
│  🏠 Explore AI Agents                                    │
│                                                         │
│  ┌─ Filter bar ──────────────────────────────────────┐  │
│  │ [All] [API Agents] [Browser Agents] [Sitemaps]    │  │
│  │                              🔍 Search agents...   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  AI Agents                                              │
│                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────┐│
│  │ Code Review AI   │ │ Scholar Search   │ │ Price Mon… ││
│  │ >_               │ │ 🌐              │ │ 🌐         ││
│  │                  │ │                  │ │            ││
│  │ Reviews PRs and  │ │ Search Google    │ │ Track pri… ││
│  │ suggests fixes   │ │ Scholar, return  │ │ across e-… ││
│  │ using AST…       │ │ structured…      │ │            ││
│  │                  │ │                  │ │            ││
│  │ [AI] [Code]      │ │ [Research]       │ │ [Shopping] ││
│  │ [LangChain]      │ │ [Browser Agent]  │ │ [Webcmd]   ││
│  │                  │ │ [Webcmd]         │ │            ││
│  └─────────────────┘ └─────────────────┘ └────────────┘│
│                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────┐│
│  │ …               │ │ …               │ │ …          ││
│  └─────────────────┘ └─────────────────┘ └────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Agent Card Anatomy

Each card contains exactly these elements, nothing more:

```
┌──────────────────────────────┐
│  Agent Name             [icon]│  ← icon: >_ for API, 🌐 for browser
│                              │
│  Two-line description that   │
│  tells you what it does.     │
│                              │
│  [Tag] [Tag] [Tag]           │  ← max 5 visible, "+N more" overflow
└──────────────────────────────┘
```

- **Icon** distinguishes agent type at a glance: `>_` (terminal icon) for API agents, `🌐` (globe) for browser agents. No label needed — the icon is the signal.
- **Tags** are pill-shaped, muted color. Functional tags like `Browser Agent` and `Webcmd` appear alongside domain tags like `Research` or `Shopping`.
- Cards are click targets. Entire card is tappable → navigates to the Agent Page.
- No pricing, no staking info, no wallet addresses on the card. The Store is for browsing, not transacting.

### Filter Bar

- **Segment control:** `All` | `API Agents` | `Browser Agents` | `Sitemaps` — filters the grid by `agentType`.
- **Search:** instant filter by name, description, tags. No submit button — filters as you type.
- Filters + search compose (e.g. "Browser Agents" + search "price" shows only browser agents matching "price").

---

## Page 2 — Agent Page (README Tab)

**Route:** `/store/:agentId`

The detail page for a single agent. Two tabs: README and Playground.

### Header

```
┌─────────────────────────────────────────────────────────┐
│  🏠 Store  >  Agent Page                                 │
│                                                         │
│  🏠 Model / Code Review AI                               │
│                                                         │
│  Code Review AI  [Public]                  [Run as API →]│
│  0x1a2b…9F4c                                             │
│  ✅ Verified identity · ERC-8004        ← trust signal  │
│                                                         │
│  Reviews PRs and suggests fixes using AST               │
│  analysis and LLM-powered reasoning.                    │
│                                                         │
│  [README]  [Playground]                                  │
│  ─────────                                              │
└─────────────────────────────────────────────────────────┘
```

- **Agent name** is the largest text element. Next to it: a `Public` badge (or `Private` for gated agents).
- **Owner address** truncated below the name, monospaced, clickable → opens testnet.monadscan.com.
- **Identity badge** — resolved from the ERC-8004 IdentityRegistry, with reputation-registry feedback count on hover. This is the trust signal. Unregistered creators show a muted `Unverified` chip instead — visible, not alarming.
- **"Run as API →"** button is the primary action — takes the user to the Playground tab with the API endpoint pre-filled. Accent-colored, top-right.
- **Agent type indicator** — for browser agents, a small `🌐 Browser Agent · Powered by Webcmd` line below the description.

### README Tab (default)

Two-column layout:

```
┌──────────────────────────────────┬──────────────────────┐
│  🔗 README                       │  RELEASES            │
│                                  │                      │
│  [Hackathon] [Evaluation]        │  Coming Very Soon    │
│  [Post-Evaluation] [Rule-Based]  │                      │
│                                  │  Release info will   │
│  ## Code Review AI               │  be available here   │
│                                  │                      │
│  A deterministic, rule-based     │──────────────────────│
│  agent for…                      │  STAKING             │
│                                  │                      │
│  ### Purpose                     │  Staked: 12,450 ANVL │
│  - Evaluates PRs…               │  Stakers: 8          │
│  - Uses AST analysis…           │  Your stake: 0       │
│  - Optionally enhances…         │  Claimable: 0        │
│                                  │                      │
│  ### Framework                   │  [Stake ANVL]        │
│  - Runtime: Bun                  │──────────────────────│
│  - Language: TypeScript          │  AGENT INFO          │
│                                  │                      │
│  ### Webcmd Details              │  Type: API Agent     │
│  (browser agents only)           │  Price: 0.01 ANVL    │
│  - Command: scholar-search      │  Calls (30d): 1,247  │
│  - Sites: Google Scholar         │  Avg response: 340ms │
│  - Avg execution: 4.2s          │  Owner: 0x1a2b…9F4c  │
│  - Auth required: No            │                      │
│                                  │                      │
└──────────────────────────────────┴──────────────────────┘
```

- **Left column (wide):** rendered markdown from the agent's README. Tags displayed as pills above the content. For browser agents, a `Webcmd Details` section shows the command name, target sites, avg execution time, and auth requirement — pulled from the `webcmd` block in agent metadata.
- **Right column (narrow):** three stacked info panels:
  - **Releases** — version history (Coming Soon for MVP).
  - **Staking** — total staked, staker count, the user's own stake, and unclaimed rewards. Rewards accrue in the contract and are pulled with `claim()`, so `Claimable` is a live number, not a pending balance.
  - **Agent Info** — type, price per call, 30-day call count, average response time, owner identity.
- **Where these numbers come from:** live values (total staked, your stake, claimable) are `eth_call` reads against `latest`. Historical values (30-day call count, revenue) come from the Envio HyperIndex indexer — the frontend can't derive those from a single call.

### Staking Modal

Triggered by `[Stake ANVL]`:

```
┌──────────────────────────────────┐
│  Stake on Code Review AI         │
│                                  │
│  Your balance: 500.00 ANVL       │
│                                  │
│  Amount:  [___________] ANVL     │
│           [25%] [50%] [75%] [Max]│
│                                  │
│  You'll earn a share of the 30%  │
│  staker revenue, proportional    │
│  to your stake.                  │
│                                  │
│  Network fee: ~$0.0004           │
│                                  │
│        [Cancel]  [Stake →]       │
└──────────────────────────────────┘
```

- Quick-fill percentage buttons.
- On confirm: one signature (EIP-2612 permit) + one transaction. No separate `approve` step — the permit is bundled into the stake call, so the user signs once and pays gas once.
- Sent with `useSendTransactionSync` and an explicit gas limit. **Never let the wallet estimate freely:** Monad charges on the gas limit, so a wallet falling back to a max limit on a failed estimate would charge the user for the whole thing.
- Success state shows the updated stake inline within ~400ms — no page reload. The row keeps a subtle "confirming" tick until the block finalizes at ~800ms.

---

## Page 3 — Agent Page (Playground Tab)

**Route:** `/store/:agentId?tab=playground`

This is where users test-drive agents. Left side: configuration. Right side: output.

### Layout

```
┌──────────────────────────────────┬──────────────────────┐
│  Agent Configuration             │  Execution Output    │
│                                  │                      │
│  ┌────────────────────────────┐  │                      │
│  │ prompt                    │  │                      │
│  │ The input prompt for…     │  │                      │
│  │ ┌──────────────────────┐  │  │        [ ? ]         │
│  │ │                      │  │  │                      │
│  │ └──────────────────────┘  │  │  (empty state:       │
│  └────────────────────────────┘  │   waiting for        │
│                                  │   execution)         │
│  ┌────────────────────────────┐  │                      │
│  │ temperature               │  │                      │
│  │ LLM temperature (0-1.0)   │  │                      │
│  │ ┌──────────────────────┐  │  │──────────────────────│
│  │ │                      │  │  │  Debug Logs          │
│  │ └──────────────────────┘  │  │                      │
│  └────────────────────────────┘  │                      │
│                                  │        [ ? ]         │
│  Env Configuration               │                      │
│  Configure the runtime and       │  (empty state:       │
│  integrations your agent needs.  │   no logs yet)       │
│                                  │                      │
│  Key  OPENAI_API_KEY             │                      │
│  Value [________] 👁️‍🗨️            │                      │
│                                  │                      │
│  Key  MONAD_RPC_URL              │                      │
│  Value [________] 👁️‍🗨️            │                      │
│                                  │                      │
│  Api Keys                        │                      │
│  Select the Api Key for your     │                      │
│  request.                        │                      │
│  [0xAnvi...399           ▾]     │                      │
│                                  │                      │
│  ┌──────────────────────────┐   │                      │
│  │         Deploy            │   │                      │
│  └──────────────────────────┘   │                      │
└──────────────────────────────────┴──────────────────────┘
```

### Left Column — Agent Configuration

- **Param fields** — auto-generated from the agent's `params` definition in `anvil.config.ts`. Each field shows: param name (bold), description (muted), and an input (text for `String`, number input for `Number`). Placeholders repeat the description.
- **Env Configuration** — key-value pairs the agent needs. Keys are pre-filled from the agent's `.env` template (read-only labels). Values are user-provided, masked by default with a visibility toggle (eye icon).
- **Api Keys** — dropdown to select which of the user's Anvil API keys to authenticate the request with.
- **Deploy button** — accent-colored, full-width. Clicking it:
  1. Validates all required fields are filled.
  2. Sends the request to the agent's M402 endpoint.
  3. If `402` returned → auto-handles payment: the wallet prompts for a **signature, not a transaction** (`useSignTypedData`), then the request retries with the `X-PAYMENT` header.
  4. Streams output to the right panel.

The user never needs MON to run an agent. They sign an EIP-712 permit; the facilitator submits and pays gas. This is the single biggest UX difference from a typical on-chain marketplace, and the copy should say so plainly: **"Sign to pay 0.01 ANVL — no gas required."**

### Right Column — Output

- **Execution Output** — JSON response from the agent, syntax-highlighted. Empty state shows a `?` icon.
- **Debug Logs** — streaming logs from the agent's execution. For browser agents, this shows Webcmd's step-by-step replay progress (e.g. "Navigating to scholar.google.com… Entering query… Parsing results…"). Empty state shows a `?` icon.
- Both panels scroll independently.
- On error, the output panel shows a human-readable explanation in red, mapped from the failure:

  | What happened | What the user sees |
  |---|---|
  | Signature expired (`deadline` passed) | "Payment signature expired — click Deploy to try again." |
  | Insufficient $ANVL | "You need 0.01 ANVL. Balance: 0.00." + a link to top up |
  | Agent function threw / Webcmd failed | The agent's error, verbatim, plus the last Webcmd step reached |
  | Settlement reverted | "Payment didn't go through — you weren't charged." (true: it's one transaction) |

### Browser Agent Playground Additions

For browser agents, the Playground gets one extra element in the left column:

```
  Webcmd Configuration
  ┌────────────────────────────┐
  │ Execution mode             │
  │ ○ Replay (fast, cached)    │  ← default
  │ ○ Live (re-learn, slower)  │
  └────────────────────────────┘
```

And the Debug Logs panel shows richer output:

```
  Debug Logs
  ┌────────────────────────────┐
  │ [00.0s] Payment signed     │
  │ [00.1s] Loading sitemap…   │
  │ [00.2s] Sitemap loaded     │
  │         (3 pages cached)   │
  │ [00.3s] Navigating to      │
  │         scholar.google.com │
  │ [01.4s] Entering query:    │
  │         "transformer arch" │
  │ [02.1s] Waiting for results│
  │ [03.8s] Parsing 10 results │
  │ [04.2s] Settling on Monad… │
  │ [04.6s] Settled ✓ 0x7a3f…  │
  └────────────────────────────┘
```

The settlement line is worth showing: it makes visible that the chain (~400ms) is a rounding error next to the browser workflow (~4s). The tx hash links to testnet.monadscan.com.

---

## Page 4 — Dev Dashboard

**Route:** `/dashboard`

Where developers manage their deployed agents.

### Sub-pages (via sidebar expand or top tabs)

#### API Keys

```
┌─────────────────────────────────────────────────────────┐
│  API Keys                                    [+ New Key] │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Key Name        Key              Created   Actions ││
│  │  Production      0xAnvi...399     Jul 12    [⋯]    ││
│  │  Development     0xAnvi...1A2     Aug 1     [⋯]    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

#### My Deployments

```
┌─────────────────────────────────────────────────────────┐
│  My Deployments                                          │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  code-review-ai     API Agent    Active   v1.0.2  │  │
│  │  scholar-search     Browser      Active   v1.0.0  │  │
│  │  amazon-sitemap     Sitemap      Active   v2.1.0  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Click any row → opens the agent's Store page.          │
└─────────────────────────────────────────────────────────┘
```

#### Analytics (stretch)

Backed entirely by the Envio HyperIndex indexer — these are historical event queries, not chain reads:

- Calls per day chart
- Revenue earned (total, by agent)
- Top callers
- Webcmd execution stats (avg time, failure rate, sitemap cache hit rate)

---

## Page 5 — Staking Dashboard

**Route:** `/stake`

```
┌─────────────────────────────────────────────────────────┐
│  Your Stakes                         Total: 1,200 ANVL  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Agent            Staked   Claimable   Actions   │   │
│  │  code-review-ai   500 ANVL  12.3   [Claim][Unstake]│ │
│  │  scholar-search   400 ANVL   8.1   [Claim][Unstake]│ │
│  │  price-compare    300 ANVL   4.7   [Claim][Unstake]│ │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  [Claim all]                                            │
│                                                         │
│  Top Staked Agents                                      │
│  (leaderboard of agents ranked by total stake)          │
└─────────────────────────────────────────────────────────┘
```

- Rewards are **pull-based** — the contract accrues them per-share and stakers claim. That's why the column is `Claimable` rather than `Earned`, and why there's a `Claim` action at all. It's also what removes any cap on stakers per agent.
- `Claim all` batches into a single transaction.
- Leaderboard ranking is indexer-served.

---

## Page 6 — AI Assistant (Slide-over Panel)

Not a full page — a panel that slides in from the bottom-right when the user clicks the AI Assistant button in the sidebar.

```
┌──────────────────────────────────┐
│  AI Assistant                 ✕  │
│──────────────────────────────────│
│                                  │
│  You: Find me an agent that can  │
│  monitor Amazon prices           │
│                                  │
│  Anvil: I found 2 browser agents │
│  that match:                     │
│                                  │
│  1. price-monitor-v2             │
│     0.02 ANVL/call · 847 calls   │
│     [View in Store →]            │
│                                  │
│  2. price-compare-v1             │
│     0.05 ANVL/call · 312 calls   │
│     [View in Store →]            │
│                                  │
│  Want me to run one of these     │
│  for you?                        │
│                                  │
│──────────────────────────────────│
│  [Type a message…         ] [→]  │
└──────────────────────────────────┘
```

- The assistant can search the Store, describe agents, and invoke them inline.
- When invoking an agent, the M402 flow happens in the background — the user sees "Signing payment…" → "Running agent…" → result. The signing step is a wallet prompt for a message, not a transaction.
- Links to Store pages are tappable.

---

## User Flows

### Flow A — Discover and run an API agent

```
Store grid
  → scan cards, see >_ icon on "Code Review AI"
  → click card
Agent Page (README tab)
  → read description, check staking numbers, see the ERC-8004 verified badge
  → click [Playground] tab
Playground
  → fill in "prompt" param
  → paste OPENAI_API_KEY in env config
  → select API key from dropdown
  → click [Deploy]
  → (if not connected: Para modal — email / passkey / social / MetaMask)
  → wallet prompts: "Sign to pay 0.01 ANVL — no gas required"
  → Execution Output shows JSON result
  → Debug Logs show timing, settlement tx links to testnet.monadscan.com
```

No opt-in step, no approval transaction, no "fund your wallet with gas" detour. First-time users go from card to result in one signature.

### Flow B — Discover and run a browser agent

```
Store grid
  → click filter: [Browser Agents]
  → see 🌐 icons, click "Scholar Search"
Agent Page (README tab)
  → read description, see "Webcmd Details" section:
    Command: scholar-search
    Sites: Google Scholar
    Avg execution: 4.2s
    Auth: No
  → click [Playground] tab
Playground
  → fill in "query" param: "transformer architectures"
  → Webcmd Configuration shows "Replay (fast, cached)" selected
  → click [Deploy]
  → wallet prompts for one signature
  → Debug Logs stream in real-time:
    [00.0s] Payment signed
    [00.3s] Navigating to scholar.google.com…
    [03.8s] Parsing results…
    [04.2s] Settling on Monad…
    [04.6s] Settled ✓
  → Execution Output shows structured JSON with papers
```

### Flow C — Stake on an agent

```
Agent Page (README tab)
  → right column shows: Staked: 12,450 ANVL · Stakers: 8
  → click [Stake ANVL]
Staking Modal
  → see balance: 500.00 ANVL
  → click [25%] → amount fills to 125.00
  → click [Stake →]
  → wallet signs permit, then confirms one transaction (~$0.0004 fee)
  → ~400ms later the panel updates: Your stake: 125.00 ANVL
  → tick clears at ~800ms when the block finalizes
```

### Flow D — Deploy a new agent (developer)

```
Terminal:
  $ anvil init my-agent          (or: webcmd learn my-command → anvil wrap my-command)
  $ cd my-agent
  $ (edit src/index.ts, anvil.config.ts)
  $ anvil deploy -k "key"
  → CLI validates config, zips project, uploads, registers on-chain

Anvil web UI:
  → Navigate to /dashboard → My Deployments (no sidebar entry — see Global Shell)
  → new agent appears in the list
  → click → Store page is live
```

### Flow E — AI Assistant discovery + invocation

```
Click 💬 AI Assistant in sidebar
  → panel slides open
  → type: "find agents for academic research"
  → assistant responds with 2-3 matching agents from Store
  → type: "run scholar-search with query 'RLHF'"
  → assistant triggers the M402 flow silently
  → wallet prompts for a payment signature
  → assistant streams Webcmd debug logs inline
  → assistant displays structured result
```

---

## Design Principles

1. **Cards, not tables.** The Store is a grid of cards. Agent detail is a card-like layout. Even the staking dashboard uses card-like rows. Cards feel browsable; tables feel like work.

2. **Type at a glance.** `>_` for API, `🌐` for browser. No labels needed on the card — the icon communicates instantly. The detail page can spell it out.

3. **Wallet is ambient.** The wallet connection lives in the top-right corner and never demands attention. Signing happens via the native Para/wallet prompt — not custom modals. The network chip only appears when something is wrong.

4. **Signatures over transactions.** Anything that can be a signed message is a signed message. Users pay for agent calls without holding MON, without an approval transaction, without a funding step. Reserve transaction prompts for staking, claiming, and registering — actions where the user is genuinely committing something.

5. **Speed is a feature, so show it.** 400ms blocks mean optimistic UI is honest almost all the time. Update immediately, keep a subtle confirming state until finality at ~800ms, and don't put a spinner in front of the user for a chain that's faster than the network request that reached it.

6. **Progressive disclosure.** The Store card shows: name, description, tags. The Agent Page adds: README, staking, pricing, owner, Webcmd details. The Playground adds: param inputs, env config, execution output, debug logs. Each level reveals more without overwhelming the previous.

7. **Browser agents aren't special UI — they're special data.** A browser agent uses the exact same card, same detail page, same playground layout as an API agent. The differences are: a 🌐 icon instead of >_, a "Webcmd Details" section in the README, a "Webcmd Configuration" toggle in the Playground, and richer debug logs. No separate "browser agent" section of the app.

8. **Coming Soon is honest.** Features not yet built (Workflows, Identity, Releases) show `Coming Soon` badges. This signals ambition without pretending features exist.

9. **The Assistant is a shortcut, not a gate.** Everything the assistant can do, the user can also do manually via the Store and Playground. The assistant is a power-user accelerator, not a required path.

---

## Component Inventory

| Component | Used On | Notes |
|---|---|---|
| Agent Card | Store grid | name, description, type icon, tags |
| Filter Bar | Store | segment control + search |
| Agent Header | Agent Page | name, badge, address, ERC-8004 identity, description, Run as API button |
| Tab Bar | Agent Page | README / Playground, accent underline on active |
| README Renderer | Agent Page (README tab) | markdown rendering, tags as pills |
| Webcmd Details Block | Agent Page (README tab) | command, sites, avg time, auth — only for browser agents |
| Staking Panel | Agent Page (README tab) | total staked, staker count, user stake, claimable, CTA button |
| Agent Info Panel | Agent Page (README tab) | type, price, call count, response time, owner |
| Releases Panel | Agent Page (README tab) | version list (Coming Soon for MVP) |
| Param Field | Playground | label, description, text/number input |
| Env Field | Playground | key (read-only), value (masked input), visibility toggle |
| API Key Selector | Playground | dropdown |
| Deploy Button | Playground | full-width accent CTA |
| Output Panel | Playground | syntax-highlighted JSON |
| Debug Logs Panel | Playground | streaming log lines, timestamped, settlement tx link |
| Webcmd Config Toggle | Playground | Replay/Live radio — browser agents only |
| Staking Modal | Agent Page | amount input, quick-fill buttons, fee estimate, confirm |
| Claim Row | Staking Dashboard | claimable amount, Claim / Unstake actions |
| AI Assistant Panel | Global (slide-over) | chat interface, agent search, inline invocation |
| Sidebar | Global | navigation, Coming Soon badges, AI Assistant trigger |
| Top Bar | Global | token balance, wallet chip, network chip (only when wrong chain) |
