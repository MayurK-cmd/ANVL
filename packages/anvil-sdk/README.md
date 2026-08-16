# @anvil/sdk

Owns `anvil.config.ts` — the file that describes an agent to the Anvil Store.

```bash
npm install -D @anvil/sdk
```

## anvil.config.ts

```ts
import type { AnvilConfig } from "@anvil/sdk";

const config: AnvilConfig = {
  name: "Scholar Search",
  description: "Search Google Scholar and return structured paper metadata",
  price: 0.01,                    // whole $ANVL per call
  devAddress: "0xYourAddress",    // receives the creator share
  port: 8000,                     // or set `endpoint` directly
  agentType: "api",               // "api" | "browser" | "sitemap"
  tags: ["Research", "M402"],
  params: {
    query: { type: String, description: "Search query", required: true },
  },
};

export default config;
```

`import type` is erased before Node runs the file, so the config loads even
when nothing is installed. Use `defineConfig()` instead if you prefer a value
import, or if you are writing `anvil.config.mjs`.

## API

| Export | Does |
|---|---|
| `defineConfig(config)` | Identity function; exists for editor type-checking |
| `validateConfig(config)` | `{ ok, errors, warnings }` — never throws |
| `assertValidConfig(config)` | Throws one error listing everything wrong |
| `toManifest(config, { cwd })` | Config → the manifest the Store ingests |
| `loadConfig(cwd)` | Finds and imports `anvil.config.{ts,mts,js,mjs}` |
| `toBaseUnits(amount, decimals)` | Decimal string maths — no float drift |
| `readEnvKeys(file)` | Key **names** from a dotenv file. Never values |
| `slugify(value)` | Store-safe agent ids |

## Two things it is careful about

**Secrets.** `readEnvKeys` returns key names only. `toManifest` uses it for
`envKeys`, so the Store learns which variables an agent expects and never sees
what they hold. This is enforced in code, not by convention.

**Money.** `toBaseUnits` does decimal string arithmetic because
`0.01 * 10 ** 18` is `9999999999999998` in JavaScript. Prices never touch
floating point.

## Requirements

Node 22.18+ — reading `anvil.config.ts` relies on native type stripping.
This package ships plain ESM plus `index.d.ts` rather than compiled TypeScript,
because Node refuses to strip types inside `node_modules` and a build step here
would become a build step for every consumer. `index.d.ts` is the schema of
record; keep it in step with `index.js` by hand.

```bash
npm test
```
