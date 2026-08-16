# @anvil/cli

Scaffold an agent, check its config, and upload it to the Anvil Store.

```bash
npm install -g @anvil/cli    # or: node packages/cli/anvil.mjs <command>
```

## The loop

```bash
anvil init scholar-search      # scaffold
cd scholar-search
# set devAddress + price in anvil.config.ts, write run() in src/index.mjs
npm start                      # serve /send on :8000
anvil validate                 # check the config without uploading
anvil deploy -k <key>          # upload the manifest to the Store
```

The agent then appears in the Store grid, and its playground calls **your**
endpoint directly — the marketplace is discovery, not a proxy.

## Commands

| Command | Does |
|---|---|
| `anvil init <name>` | Scaffolds `anvil.config.ts`, `src/index.mjs`, README, `.env` |
| `anvil validate` | Loads and validates the config, prints the derived manifest |
| `anvil deploy -k <key>` | Validates, builds the manifest, POSTs it to the Store |
| `anvil wrap <command>` | Not built yet — needs the Webcmd runtime (PRD phase 2) |

## Options

| Flag | Default |
|---|---|
| `-k, --key` | `$ANVIL_DEPLOY_KEY` |
| `--url` | `$ANVIL_STORE_URL`, else `http://localhost:3000` |
| `--dry-run` | Print the manifest, upload nothing |
| `-v, --verbose` | Full manifest and HTTP details |

The Store must have `ANVIL_DEPLOY_KEY` set or `POST /api/agents` answers `503` —
an endpoint that writes to disk does not default open.

## What gets uploaded

The manifest built by `@anvil/sdk`: id, name, description, tags, type, owner,
price (whole and base units), endpoint, params, purpose, README, and the
**names** of the variables in your `.env`.

Never the values. `anvil deploy --dry-run` prints exactly what would go, and
there is a test asserting a secret in `.env` does not appear in the payload.

## Requirements

Node 22.18+, for native type stripping when reading `anvil.config.ts`.
Rename the file to `anvil.config.mjs` if you are stuck on an older runtime.

```bash
npm test
```
