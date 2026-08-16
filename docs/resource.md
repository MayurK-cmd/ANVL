1) https://docs.monad.xyz/ — Monad developer docs (start here)

2) Webcmd -> https://github.com/agentrhq/webcmd

3) monskills -> the `.agents/skills/` folder in this repo. Start at `monskill/SKILL.md`,
   which routes to: `why-monad/`, `concepts/`, `addresses/`, `gas/`, `scaffold/`,
   `wallet-integration/`, `tooling-and-infra/`, `indexer/`.


You Don't Need to Be a "Blockchain Developer" to Join
A common misconception: this is not a hackathon that requires you to be an experienced blockchain developer.

At its simplest, here's what qualifies you to participate:

Build a regular Web2 application (a web app, an API, a SaaS tool, an AI agent, anything you'd normally build).
Integrate x402 endpoints into it, so that some part of your app can charge or pay for access using the x402 protocol.
That's it. You're extending something familiar with one new capability, not starting from scratch in an unfamiliar stack.

What is x402, in Simple Terms?
x402 is a protocol that lets an application charge for access to an API endpoint using the HTTP 402 Payment Required status code, an existing but rarely-used part of the web's HTTP standard.

In plain terms: instead of a user or an app needing an account, a subscription, or an API key to access a paid resource, they simply pay a small amount at the moment they make the request, and the request goes through automatically. No sign-ups, no invoices, no manual approvals. On Monad, these payments confirm in 400ms, finalize in 800ms, and cost a fraction of a cent, which makes it practical for machines and AI agents to pay each other for small, one-off actions.

A simple example:

Imagine a Web2 weather API that normally requires an API key and a monthly subscription to use. With x402 integrated:

A developer (or an AI agent) sends a request to your /weather endpoint.
Instead of an API key, the request is met with an HTTP 402 response asking for a tiny payment (say, $0.001).
The requester signs an EIP-712 permit for that amount — offline, no gas needed on their side.
Your endpoint verifies the signature, submits one transaction on Monad, and returns the weather data instantly.
You still built a normal Web2 API. The only difference is that it can now get paid per request, automatically, without subscriptions or manual billing. This same pattern applies to any endpoint: AI agents paying each other for data, tools, or compute, pay-per-use apps, content unlocks, and more.

Monad Technical Resources — Testnet

Anvil builds against Monad Testnet. Every entry below is the testnet one.

| Resource | Where |
|---|---|
| Docs | https://docs.monad.xyz |
| RPC | https://testnet-rpc.monad.xyz |
| Chain ID | 10143 |
| Explorer | https://testnet.monadscan.com |
| Faucet | https://faucet.monad.xyz |
| viem / wagmi chain | `monadTestnet` |
| Verification API | https://agents.devnads.com/v1/verify with `"chainId": 10143` |
| Tooling & infra directory | https://docs.monad.xyz/tooling-and-infra/ |
| Contract addresses | `.agents/skills/addresses/SKILL.md`, https://github.com/monad-crypto/protocols (`protocols/testnet/*.json`) |

What is and isn't deployed on testnet — verified with `eth_getCode` on 2026-08-13:

| Contract | Testnet |
|---|---|
| CreateX `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` | ✅ |
| Permit2 `0x000000000022d473030f116ddee9f6b43ac78ba3` | ✅ |
| Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11` | ✅ |
| Foundry deterministic deployer `0x4e59b44847b379578588920ca78fbf26c0b4956c` | ✅ |
| ERC-8004 Identity/Reputation registries | ❌ mainnet only — deploy your own |
| USDC, WMON | ❌ mainnet only |

The addresses skill lists the ERC-8004 registries as identical on mainnet and testnet. That is true of mainnet
only right now. Always re-check: `cast code <addr> --rpc-url https://testnet-rpc.monad.xyz`

Because Monad is Ethereum-compatible, the standard EVM toolchain works unchanged:

Foundry — contract build, test, deploy, verify (https://www.getfoundry.sh)
OpenZeppelin — don't rebuild ERC-20/ERC-721 from scratch, they're audited already
viem / wagmi v3 — frontend contract reads and writes
Next.js + shadcn — the default frontend stack in the scaffold skill
Para (`@getpara/cli`) — embedded MPC wallets (email / passkey / social) plus external-wallet connect
Envio HyperIndex — indexing historical onchain events for feeds, leaderboards, analytics

Contract verification: use the one-call verification API (`https://agents.devnads.com/v1/verify`), which
verifies on MonadVision, Socialscan, and Monadscan at once. See `scaffold/SKILL.md`.

Gas gotcha worth reading before you write a line of transaction code: Monad charges on the gas
*limit*, not gas used. A sloppy limit costs your users real money. See `gas/SKILL.md`.

Starter path: scaffold with `scaffold/SKILL.md` (web/ + contracts/ + optional indexer/), layer your
Web2 application idea on top, integrate your x402 endpoint(s), and you're ready to build.
