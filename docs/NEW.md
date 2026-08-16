# Anvil Agent Upgrade Spec
## Scholar Compare + Price Monitor

This document is the implementation specification for Claude Code.

Build two production-ready Anvil agents:

1. **Scholar Compare** — a research agent that finds academic papers and compares them.
2. **Price Monitor** — a shopping agent that searches multiple Indian storefronts and compares equivalent listings.

Both must use the existing Anvil architecture:
- M402 payment middleware
- $ANVL payments
- existing Monad settlement
- existing agent registry
- existing Webcmd integration
- existing frontend/agent-card patterns

Do not create a new payment architecture or duplicate existing infrastructure.

---

# Part 1 — Scholar Compare

## 1. Goal

Create a new Anvil agent:

```text
Scholar Compare
```

Purpose:

> Find relevant academic papers for a research topic and produce a structured comparison of their approaches, contributions, findings, and limitations.

This is a separate agent from the existing **Scholar Search** agent.

### Existing Scholar Search

> Search arXiv and return structured paper metadata.

### New Scholar Compare

> Search academic literature, select relevant papers, gather available information, and compare them using an LLM.

---

## 2. Agent Metadata

Use the project's existing agent definition and registration format.

Recommended metadata:

```js
{
  id: "scholar-compare-v1",
  name: "Scholar Compare",
  description:
    "Compare academic papers on a research topic and return structured differences, contributions, methods, and limitations.",
  tags: ["Research", "Academic", "Browser Agent", "Webcmd"],
}
```

Use the existing project conventions for:
- price
- owner
- token
- endpoint
- registry registration
- agent type

Do not invent a new registration system.

---

## 3. User Experience

Example queries:

```text
Compare papers about zero knowledge proofs
```

```text
Compare recent papers on RAG
```

```text
Compare papers about ZK proofs for blockchain
```

The agent should:

1. Search for relevant papers.
2. Select a small number of useful papers.
3. Retrieve additional information where available.
4. Send structured paper information to the existing LLM/provider abstraction.
5. Produce a useful comparison.
6. Return both human-readable data and structured JSON.
7. Include source URLs.

---

## 4. Core Flow

```text
User query
    ↓
Scholar Compare
    ↓
webcmd arxiv search
    ↓
Candidate papers
    ↓
Select 3–5 relevant papers
    ↓
Retrieve available metadata / abstracts
    ↓
LLM analysis
    ↓
Comparison
    ↓
Structured result
```

The primary demo query should be:

```text
Compare papers about zero knowledge proofs
```

The data must be live.

Do not hardcode example papers.

---

## 5. Webcmd Integration

Use the existing Webcmd installation and existing adapter infrastructure.

Current command:

```bash
webcmd arxiv search "<query>"
```

Prefer structured output:

```bash
webcmd arxiv search "<query>" -f json
```

Use the existing Scholar Search implementation as the reference for:
- Webcmd invocation
- JSON parsing
- error handling
- timeouts
- environment configuration

Do not duplicate Webcmd infrastructure.

Do not replace Webcmd with direct scraping unless required by the existing architecture.

---

## 6. Paper Selection

Default to comparing **3 papers**.

Allow a configurable limit if the existing API architecture supports it:

```json
{
  "query": "zero knowledge proofs",
  "limit": 3
}
```

Maximum:

```text
5 papers
```

Prefer:
1. relevance to the query
2. recent papers when the query asks for recent/latest work
3. distinct papers
4. papers with sufficient available information

If only 1–2 useful papers are returned, compare those instead of fabricating additional papers.

---

## 7. Paper Data

At minimum collect:

```text
title
authors
year
url
```

Collect additional fields when the existing Webcmd adapter exposes them:

```text
abstract
publication date
categories
paper ID
PDF URL
```

Do not fabricate missing data.

If full paper text is not available through the existing Webcmd adapter, do not create a fragile scraping system just for this feature.

---

## 8. LLM Comparison

Reuse the project's existing LLM/provider abstraction.

Do not hardcode a new provider or model.

The LLM should compare each paper on:

### Problem
What problem is the paper trying to solve?

### Approach
What is the core methodology or approach?

### Contribution
What does the paper contribute?

### Results / Findings
What does the paper demonstrate?

Only state results supported by the retrieved information.

### Limitations
What limitations or tradeoffs are apparent from the available information?

Do not invent experimental limitations.

### Key Differences
What fundamentally distinguishes the papers?

### Overall
Give a concise synthesis of the comparison.

---

## 9. Recommended Structured Output

Prefer structured JSON from the LLM.

Example:

```json
{
  "summary": "Short overview of the research area.",
  "papers": [
    {
      "title": "...",
      "authors": ["..."],
      "year": 2024,
      "url": "...",
      "problem": "...",
      "approach": "...",
      "contribution": "...",
      "results": "...",
      "limitations": "..."
    }
  ],
  "comparison": {
    "keyDifferences": [
      "...",
      "...",
      "..."
    ],
    "overall": "..."
  }
}
```

Adapt this to the existing project's response conventions if necessary.

---

## 10. Human-Readable Output

The frontend should be able to render something like:

```text
Scholar Compare

Topic:
Zero Knowledge Proofs

Compared 3 papers

1. Paper Title
   Authors: ...
   Year: ...

   Approach:
   ...

   Contribution:
   ...

2. Paper Title
   ...

Key differences

• Paper 1 focuses on ...
• Paper 2 focuses on ...
• Paper 3 focuses on ...

Overall

...
```

Source URLs must be visible/clickable.

---

## 11. API Response

Return structured JSON similar to:

```json
{
  "query": "zero knowledge proofs",
  "papersCompared": 3,
  "papers": [
    {
      "title": "...",
      "authors": ["..."],
      "year": 2024,
      "url": "...",
      "problem": "...",
      "approach": "...",
      "contribution": "...",
      "results": "...",
      "limitations": "..."
    }
  ],
  "comparison": {
    "keyDifferences": [
      "...",
      "...",
      "..."
    ],
    "overall": "..."
  }
}
```

Do not hardcode this example.

---

## 12. Error Handling

### Webcmd unavailable

Return a clear error. Do not return fake papers.

### No papers found

Return:

```text
No relevant papers were found for this query.
```

### Fewer than 3 papers

Use the available papers and indicate the actual count.

### LLM failure

Return the retrieved paper metadata as partial output rather than discarding the whole result.

Example:

```json
{
  "status": "partial",
  "papers": [],
  "comparison": null,
  "error": "Comparison generation failed."
}
```

---

## 13. M402 Integration

Scholar Compare must use the existing Anvil M402 flow.

Do not create a separate payment system.

Expected flow:

```text
Client
  ↓
Scholar Compare endpoint
  ↓
402 Payment Required
  ↓
User signs ANVL authorization
  ↓
X-PAYMENT
  ↓
Payment verification
  ↓
Scholar Compare executes
  ↓
Webcmd
  ↓
LLM comparison
  ↓
Result
  ↓
Existing facilitator settlement
  ↓
Monad
```

Use the project's existing price/payment configuration.

---

# Part 2 — Price Monitor

## 14. Goal

Upgrade the existing **Price Monitor** agent from a single Amazon search into a multi-store price comparison agent.

The user should be able to enter:

```text
iPhone 14
```

and receive current listings from:

- Amazon
- Flipkart
- Reliance Digital
- Croma

The agent should normalize the results, compare equivalent products, identify the best price, and return structured data.

---

## 15. Agent Metadata

Keep the existing agent ID if it already exists:

```text
price-monitor-v1
```

Do not create a second Price Monitor agent unless the existing project architecture requires versioning.

Recommended metadata:

```js
{
  id: "price-monitor-v1",
  name: "Price Monitor",
  description:
    "Track a product across storefronts and return the best current listing.",
  tags: ["Shopping", "Browser Agent", "Webcmd"],
}
```

Keep the existing owner, price, token, endpoint, and registry configuration.

---

## 16. User Experience

Example:

```text
Search:
iPhone 14
```

The agent searches:

```text
Amazon
Flipkart
Reliance Digital
Croma
```

Then presents a concise result:

```text
iPhone 14

₹XX,XXX — Amazon
⭐ 4.4 · 13,200 reviews
📦 In stock

₹XX,XXX — Flipkart
⭐ 4.3 · 8,400 reviews
📦 In stock

₹XX,XXX — Reliance Digital
⭐ 4.5 · 2,100 reviews
📦 In stock

₹XX,XXX — Croma
⭐ 4.4 · 1,800 reviews
📦 In stock

🏆 Best price: ₹XX,XXX — Croma
```

Use actual data returned by the storefronts.

Never invent prices, ratings, review counts, availability, or sellers.

---

## 17. Webcmd Store Integrations

Use Webcmd adapters for each storefront where available.

Existing Amazon adapter:

```bash
webcmd amazon search "<query>" -f json
```

Add integrations for:

```text
Flipkart
Reliance Digital
Croma
```

First inspect the installed Webcmd commands/adapters.

For example:

```bash
webcmd list
```

and:

```bash
webcmd <site> --help
```

Do not assume command names or arguments.

If an adapter is not currently available, inspect the existing Webcmd/plugin/adapter mechanism before implementing a custom scraper.

The architecture should make each store an independent source.

---

## 18. Store Search Architecture

Use a common normalized internal representation.

Each store adapter should produce data mapped into something like:

```ts
type ProductListing = {
  store: string;
  title: string;
  price: number | null;
  currency: "INR";
  rating: number | null;
  reviewCount: number | null;
  availability: string | null;
  seller: string | null;
  url: string;
  imageUrl?: string | null;
};
```

Adapt field names to the existing codebase.

Do not force every store to provide every field.

Use `null` when information is unavailable.

---

## 19. Product Normalization

This is important.

Do not simply sort every listing by price.

The agent must try to compare equivalent products.

For example:

```text
Apple iPhone 14 128GB Blue
```

and:

```text
Apple iPhone 14 256GB Blue
```

are NOT equivalent.

Likewise:

```text
New
```

and:

```text
Renewed / Refurbished
```

are NOT equivalent unless the user explicitly asks for them.

Normalize relevant attributes where possible:

```text
brand
model
storage
color
condition
variant
```

If the query does not specify a variant and results contain different variants, clearly indicate the variant alongside the price.

---

## 20. Best Price Logic

Determine the best price among comparable listings.

Primary rule:

```text
lowest valid price
```

But only compare equivalent products.

If the cheapest result is refurbished/renewed while others are new, do not silently call it the best price.

Return:

```text
Best price for new equivalent product
```

or separate categories:

```text
Best new price
Best renewed price
```

when appropriate.

---

## 21. Human-Readable Result

The UI should prioritize the useful information:

```text
iPhone 14

₹44,999 — Amazon
⭐ 4.4 · 13,200 reviews
📦 In stock

₹43,999 — Flipkart
⭐ 4.3 · 8,400 reviews
📦 In stock

₹45,499 — Reliance Digital
⭐ 4.5 · 2,100 reviews
📦 In stock

₹42,999 — Croma
⭐ 4.4 · 1,800 reviews
📦 In stock

🏆 Best price: ₹42,999 — Croma
```

The exact formatting can follow the existing Anvil frontend style.

---

## 22. Structured JSON Output

After the human-readable result, the agent/API should return complete structured data.

Example:

```json
{
  "product": "iPhone 14",
  "bestPrice": {
    "price": 42999,
    "currency": "INR",
    "store": "Croma",
    "url": "https://example.com/product"
  },
  "listings": [
    {
      "store": "Amazon",
      "title": "Apple iPhone 14, 128GB, Blue",
      "price": 44999,
      "currency": "INR",
      "rating": 4.4,
      "reviewCount": 13200,
      "availability": "In stock",
      "seller": "Example Seller",
      "url": "https://example.com/product"
    },
    {
      "store": "Flipkart",
      "title": "Apple iPhone 14 128GB Blue",
      "price": 43999,
      "currency": "INR",
      "rating": 4.3,
      "reviewCount": 8400,
      "availability": "In stock",
      "seller": "Example Seller",
      "url": "https://example.com/product"
    }
  ]
}
```

Use real URLs and real values.

If a store does not expose price, return:

```json
"price": null
```

rather than inventing one.

---

## 23. Store Failure Handling

One store being unavailable must not kill the whole agent.

Example:

```text
Amazon       ✓
Flipkart     ✓
Reliance     ✓
Croma        ✗
```

Return the available results and clearly indicate the unavailable source if appropriate.

Example structured response:

```json
{
  "product": "iPhone 14",
  "sources": {
    "amazon": "success",
    "flipkart": "success",
    "relianceDigital": "success",
    "croma": "unavailable"
  },
  "listings": []
}
```

Do not fabricate missing store data.

---

## 24. M402 Integration

Price Monitor must continue using the existing M402 payment flow.

Do not change the payment contracts or create a separate payment path.

Flow:

```text
User
  ↓
Price Monitor
  ↓
402 Payment Required
  ↓
Sign ANVL authorization
  ↓
X-PAYMENT
  ↓
Payment verification
  ↓
Price Monitor executes
  ↓
Webcmd → Amazon / Flipkart / Reliance / Croma
  ↓
Normalize + compare
  ↓
Result
  ↓
Existing settlement
  ↓
Monad
```

---

# Part 3 — Shared Frontend Changes

## 25. Marketplace

The marketplace should show:

```text
Scholar Search
Scholar Compare
Price Monitor
```

Use the existing agent card component.

Do not create a new design system.

---

## 26. Scholar Compare Card

Recommended copy:

```text
Scholar Compare

Compare academic papers on a research topic
and understand their key differences.

Research · Academic · Webcmd

XX ANVL / call

[ Run ]
```

---

## 27. Price Monitor Card

Recommended copy:

```text
Price Monitor

Track a product across storefronts and find
the best current price.

Shopping · Browser Agent · Webcmd

XX ANVL / call

[ Run ]
```

---

# Part 4 — Architecture

The final architecture should look like:

```text
                         ANVIL
                           │
                  Agent Marketplace
                           │
             ┌─────────────┼─────────────┐
             │             │             │
       Scholar Search  Scholar Compare  Price Monitor
             │             │             │
             │             │             │
          Webcmd         Webcmd         Webcmd
             │             │             │
           arXiv         arXiv       ┌────┼────┬────┐
                                     │    │    │    │
                                  Amazon Flip Reliance Croma
                                     │    │    │    │
                                     └────┴────┴────┘
                                             │
                                          Compare
                                             │
                                           Result

Payment for every agent:

User
  ↓
M402 / HTTP 402
  ↓
EIP-712 ANVL authorization
  ↓
Agent executes
  ↓
Facilitator
  ↓
Monad settlement
  ↓
50% Creator
30% Stakers
20% Treasury
```

---

# Part 5 — Implementation Rules

## Reuse first

Before writing code, inspect:

```text
Scholar Search implementation
Price Monitor implementation
Webcmd adapter code
M402 SDK/middleware
Agent Registry integration
Agent marketplace frontend
LLM/provider abstraction
```

Follow established patterns.

## Do not duplicate

Do not create:
- a new payment middleware
- a new token
- a new registry
- a second facilitator
- a separate agent execution framework
- a separate frontend component system

## Do not fake data

Both agents must use real external data.

Never hardcode:
- prices
- ratings
- review counts
- availability
- paper metadata
- comparison results

Example data in this specification is illustrative only.

---

# Part 6 — Acceptance Criteria

## Scholar Compare

- [ ] `scholar-compare-v1` exists.
- [ ] Appears in marketplace.
- [ ] Has configured ANVL price.
- [ ] Uses existing M402 middleware.
- [ ] Performs real Webcmd arXiv search.
- [ ] Uses structured search results.
- [ ] Selects 3 papers by default.
- [ ] Supports up to 5 papers.
- [ ] Handles fewer than 3 results.
- [ ] Sends paper information to existing LLM infrastructure.
- [ ] Produces comparison of problem, approach, contribution, findings, and limitations where supported.
- [ ] Returns key differences.
- [ ] Includes source URLs.
- [ ] Returns structured JSON.
- [ ] Handles Webcmd failure.
- [ ] Handles LLM failure with partial data.

## Price Monitor

- [ ] Existing `price-monitor-v1` remains the agent.
- [ ] Appears in marketplace.
- [ ] Uses existing M402 middleware.
- [ ] Searches Amazon.
- [ ] Searches Flipkart.
- [ ] Searches Reliance Digital.
- [ ] Searches Croma.
- [ ] Uses Webcmd adapters where available.
- [ ] Normalizes product listings.
- [ ] Distinguishes important variants such as storage and condition.
- [ ] Does not compare refurbished/renewed against new without making the distinction clear.
- [ ] Identifies the lowest valid comparable price.
- [ ] Returns store, title, price, rating, review count, availability, seller, and URL where available.
- [ ] Shows a concise human-readable result.
- [ ] Returns complete structured JSON.
- [ ] Handles individual store failures without failing the entire agent.
- [ ] Never fabricates unavailable data.

## End-to-End

- [ ] Both agents can be discovered from the Anvil marketplace.
- [ ] User can run each agent.
- [ ] MetaMask requests an ANVL authorization rather than a normal gas-paying transaction.
- [ ] Agent executes after payment authorization.
- [ ] Existing facilitator handles settlement.
- [ ] Settlement occurs on Monad.
- [ ] No changes to existing payment contracts are required.

---

# Part 7 — Demo Scenarios

## Scholar Compare

Use:

```text
Compare papers about zero knowledge proofs
```

Expected:

```text
Search live academic data
        ↓
Select papers
        ↓
Analyze
        ↓
Compare approaches
        ↓
Show sources
```

## Price Monitor

Use:

```text
iPhone 14
```

Expected:

```text
Amazon
Flipkart
Reliance Digital
Croma
        ↓
Normalize equivalent listings
        ↓
Compare
        ↓
🏆 Best price
```

---

# Final Product Definition

Do not think of these as simple website wrappers.

### Scholar Compare

> A paid research capability that uses Webcmd to retrieve live academic information and an LLM to turn that information into a useful paper comparison.

### Price Monitor

> A paid shopping capability that uses Webcmd to retrieve live storefront listings, normalize equivalent products, and identify the best available price.

Both demonstrate the same Anvil thesis:

> **Webcmd gives agents access to the outside world. Anvil gives those capabilities a marketplace and an economic layer. M402 handles pay-per-use authorization. Monad handles settlement.**

The implementation priority is:

1. Reuse existing infrastructure.
2. Make both agents work end-to-end.
3. Use real external data.
4. Make the outputs excellent.
5. Only then add polish or additional features.
