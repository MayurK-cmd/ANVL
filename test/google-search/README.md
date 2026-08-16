# Google Search

Live Google web search as a paid Anvil agent. One HTTP handler, no dependencies —
it calls Google's Custom Search JSON API with `fetch`.

## Purpose

Give any buyer (human or another agent) fresh, ranked web results as structured
JSON, instead of whatever a model remembers from its training cut-off.

## Setup

Two free credentials, both needed:

1. **`GOOGLE_API_KEY`** — [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
   Create an API key, then enable **Custom Search API** for the project.
2. **`GOOGLE_CSE_ID`** — [programmablesearchengine.google.com](https://programmablesearchengine.google.com/).
   Create a search engine and switch on **Search the entire web**; the `cx` value
   is the id.

Put both in `.env`. Free tier is **100 queries/day**; past that Google answers
429 and the agent surfaces that as an error.

## Running it

```bash
npm start                    # serves /send on port 8000
anvil validate               # check anvil.config.ts
anvil deploy -k <key>        # upload to the Store
```

Before deploying, set `devAddress` in `anvil.config.ts` to the address that
should receive the creator share. It ships as the zero address, which
`anvil validate` rejects on purpose.

## Calling it

```bash
curl -s localhost:8000/send \
  -H 'Content-Type: application/json' \
  -d '{"query":"monad testnet rpc","count":3}'
```

```json
{
  "result": {
    "query": "monad testnet rpc",
    "totalResults": 132000,
    "results": [
      {
        "title": "Network Information | Monad Docs",
        "url": "https://docs.monad.xyz/...",
        "source": "docs.monad.xyz",
        "snippet": "Monad Testnet RPC endpoint …"
      }
    ]
  },
  "logs": ["[0.4s] Query: monad testnet rpc", "[0.4s] Google returned 3 of ~132000 results"]
}
```

| Param   | Type   | Required | Notes                              |
| ------- | ------ | -------- | ---------------------------------- |
| `query` | string | yes      | The search query                   |
| `count` | number | no       | 1–10, default 5. Clamped, not rejected |

## Payment

The Store client speaks M402: it sends `X-PAYER`, expects `402` with an
`X-PAYMENT-REQUIRED` challenge, signs an EIP-2612 permit, and retries with
`X-PAYMENT`. This agent answers `200` immediately, so calls are free until a
payment gate goes in front of `run()`.

## Notes

- Agent id: `google-search`
- Network: Monad Testnet (chain id 10143)
- Requests time out at 15s so a hung Google call cannot pin a paying buyer.
- Never commit `.env`. `anvil deploy` uploads env KEY NAMES only, never values.
- Scraping `google.com` directly is not an option here — it is blocked,
  rate-limited, and against Google's terms. The Custom Search API is the
  supported path.
