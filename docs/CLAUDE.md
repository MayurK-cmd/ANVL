# CLAUDE.md — Anvil

## Identity

You are building Anvil, an AI agent marketplace on Monad. This repo is an **MVP scaffold**: Store UI + the M402 payment backend. Do not expand into contracts, Webcmd, CLI, or staking unless asked.

## Operations

- `pnpm dev` — marketplace + demo agent routes
- `pnpm test` — M402 verify tests
- `pnpm build` — production build
- `node --test packages/anvil-sdk/test.mjs` — config schema tests
- `node --test packages/cli/test.mjs` — CLI tests
- `node packages/cli/anvil.mjs <cmd>` — run the CLI without a global install

## Constraints

- Target network is **Monad Testnet only** — chain id `10143`, RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadscan.com`, faucet `https://faucet.monad.xyz`. Never add a mainnet branch; mainnet is a cutover, not a runtime toggle
- M402 lives in `src/lib/m402.ts` — extract to `packages/m402-sdk` when the protocol is stable
- Agent catalog is `src/data/agents.ts` (fixtures) merged with `.anvil/agents.json` (uploads) by `src/lib/registry.ts` — replace the file store with AgentRegistry later
- `packages/anvil-sdk` and `packages/cli` are standalone and build-free: plain ESM, no bundler, no TypeScript compile. They must never import from the app, and the app must never import from them — the Store re-validates uploaded manifests at its own trust boundary
- `anvil deploy` uploads env KEY NAMES only. Never add a code path that reads a `.env` value into a manifest
- Uploaded agents are called directly from the browser at their own `endpoint`. The Store is discovery, not a payment proxy
- Browser agents are fixtures, not live Webcmd
- Payments are **real EIP-2612 permit signatures**, verified with viem. Two modes: dev (verify only) and settling (needs `M402_TOKEN_ADDRESS` + `M402_PAY_TO` + `M402_FACILITATOR_KEY`, see `.env.example`). Never make the dev path report `settled: true`
- Always verify the payment before running the agent, and settle only after it succeeds — a payer is never charged for a failed run
- `m402.ts` is isomorphic and must stay secret-free; anything touching the RPC or the facilitator key belongs in `facilitator.ts`
- Wallet is MetaMask (any EIP-1193 injected provider) via viem — no wagmi, no connector library. `lib/wallet.ts` owns provider access, chain switching, and signing; `components/wallet-provider.tsx` owns the React state. Para drops in by replacing `signerFor()`, which returns the `{ payer, signTypedData }` shape `callPaidAPI` expects
- Never gate a *run* behind having MON. Paying for an agent is a signature; only staking and claiming cost gas
- `tsconfig` target must stay at ES2020 or higher — viem uses BigInt literals
- Gas is charged on the gas *limit* on Monad — always set explicit limits, never let a wallet fall back to a max estimate
- Contract addresses come from env vars, never literals. Verify any address before use: `cast code <addr> --rpc-url https://testnet-rpc.monad.xyz`
- On testnet, ERC-8004 registries and USDC are **not** deployed at their canonical mainnet addresses (verified 2026-08-13) — deploy your own. Live on testnet: CreateX, Permit2, Multicall3, Foundry deterministic deployer
- Credentials are never stored

## File conventions

- UI: `src/app/`, `src/components/`
- Protocol (isomorphic, no secrets): `src/lib/m402.ts`
- Facilitator (server-only — chain reads, settlement, private key): `src/lib/facilitator.ts`
- Wallet (MetaMask via viem): `src/lib/wallet.ts` + `src/components/wallet-provider.tsx`
- Paid endpoint: `src/app/api/agents/[id]/send/route.ts`
- Catalog: `src/data/agents.ts`
- Tests next to source: `*.test.ts`
