# Anvil

Local MVP of the Anvil agent store. Browse three mock agents, open a listing, and run the A402 pay-then-execute loop without TestNet.

## Run

```bash
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:3000

1. Click **Echo Bench** (or Scholar Search / Price Monitor).
2. Open **Playground**.
3. Fill the required field and click **Run**.
4. First request returns HTTP 402; the client attaches a local payment and retries.
5. Output and debug logs appear on the right.

```bash
pnpm test
```

runs the A402 verify checks.

## What this MVP includes

- Store grid with type filter + search
- Agent README + Playground
- Local A402: `402` → `X-PAYMENT` → execute
- Three catalog agents (echo is real logic; browser agents return fixtures)

## Not in this cut

Contracts, $ANVL ASA, staking, Webcmd runtime, CLI, NFD, wallet signing, workflows, AI assistant. Add those after the store loop feels right.

See `docs/prd.md` and `docs/ui_flow.md` for the full product.
