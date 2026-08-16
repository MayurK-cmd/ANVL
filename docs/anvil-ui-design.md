# Anvil UI/UX Design Specification

## Goal

Design Anvil as a polished, modern **white-first AI agent marketplace** built on Monad.

The UI should feel like a real product — closer to **Stripe + Linear + modern AI tooling** than a generic Web3/DeFi dashboard.

**Do NOT make this a generic black crypto theme.**

---

## 1. Visual Direction

Keywords:

- White
- Clean
- Technical
- Premium
- Fast
- Developer-native
- Marketplace
- Monad-inspired
- Strong typography
- Crisp cards
- Subtle borders
- Purple + mint accents
- Excellent information hierarchy

Principle:

> **Useful first. Crypto underneath.**

Users should understand the agent before they need to understand blockchain.

---

## 2. Color System

Use a predominantly white/light interface.

### Base

```text
Background:       #FFFFFF
Surface:          #F8F8FA
Border:           #E7E7EC
Text primary:     #17171C
Text secondary:   #62626B
Text muted:       #8C8C96
```

### Monad-inspired primary

```text
Monad Purple:     #836EF9
Purple dark:      #6952E8
Purple light:     #EEEAFE
```

Use purple for:

- primary CTA
- active navigation
- selected states
- agent prices
- important links
- focus states
- Anvil logo accent

### Secondary success/on-chain accent

```text
Mint:             #A6F4D0
Mint dark:        #1D8A62
Mint light:       #E8FBF2
```

Use mint for:

- successful payments
- verified states
- live/on-chain states
- completed workflows

### Errors

```text
Warning:          #B7791F
Warning bg:       #FFF8E7

Error:            #C63C4A
Error bg:         #FFF0F2
```

---

## 3. Avoid

Do NOT use:

- full black backgrounds
- black cards
- excessive gradients
- neon crypto aesthetics
- excessive purple
- glowing borders
- giant Web3 cards
- glassmorphism everywhere
- rainbow gradients
- generic robot illustrations
- excessive emoji
- pointless charts
- excessive shadows

The product should feel serious and usable.

---

## 4. Typography

Prefer Inter or the project's existing high-quality sans-serif.

Hierarchy:

```text
Hero:       48–64px, 700–800
Page title: 32–40px, 700
Section:    20–24px, 650–700
Body:       14–16px
Metadata:   12–13px
```

Use tight line-height for headings and generous whitespace around sections.

---

## 5. Layout

Desktop max width:

```text
1200–1280px
```

Horizontal padding:

```text
24px mobile
32px tablet
40–48px desktop
```

Prefer whitespace over decoration.

---

# 6. Navigation

Clean white header:

```text
┌───────────────────────────────────────────────────────────────┐
│  ⚒ ANVIL     Agents     Stake     Identity     Docs   [Connect]│
└───────────────────────────────────────────────────────────────┘
```

The Anvil mark should be a simple geometric anvil/forge-inspired symbol, not a 3D blacksmith illustration.

Wallet area should feel like a product account:

```text
┌────────────────────────────┐
│  ●  0x213C...955D          │
│     12.40 ANVL · 0.42 MON  │
└────────────────────────────┘
```

Show:

```text
● Monad Testnet
```

as a small status pill.

---

# 7. Marketplace Homepage

Hero:

```text
AI agents,
for every task.

Discover useful agents.
Pay per call.
Let them do the work.

[ Explore Agents ]  [ Build an Agent ]
```

Do not lead with blockchain jargon.

Agent grid:

```text
3 columns desktop
2 columns tablet
1 column mobile
```

Example:

```text
┌────────────────────────────────────────┐
│ ✦ Scholar Compare          ✓ On-chain │
│                                        │
│ Compare academic papers and surface   │
│ the key differences.                  │
│                                        │
│ Research   Academic   Webcmd           │
│                                        │
│ ───────────────────────────────────── │
│                                        │
│ 0.08 ANVL / call        [ Run → ]      │
└────────────────────────────────────────┘
```

Card styling:

```text
white background
1px #E7E7EC border
14–18px radius
very subtle shadow
```

Hover:

- subtle border transition
- tiny elevation
- stronger purple CTA

No large animations.

---

# 8. Agent Badges

Use small pills:

```text
Research
Academic
Webcmd
Shopping
Workflow
```

Identity:

```text
✓ ERC-8004 #4
```

or:

```text
✓ On-chain identity
```

Verified badges should use mint/light green.

Unverified:

```text
Unverified identity
```

Use neutral gray.

---

# 9. Agent Detail Page

Keep the actual interaction above the fold.

```text
← Back to Agents

✦ Scholar Compare                         ✓ On-chain #4

Compare academic papers on a research topic and understand
their key differences.

Research · Academic · Webcmd

┌─────────────────────────────┐  ┌────────────────────────┐
│ Run Agent                   │  │ On-chain               │
│                             │  │                        │
│ Your query                  │  │ Owner                  │
│ [ zero knowledge proofs ]   │  │ 0x213C...955D          │
│                             │  │                        │
│ Cost                        │  │ Price                  │
│ 0.08 ANVL                   │  │ 0.08 ANVL / call       │
│                             │  │                        │
│ [ Run → ]                   │  │ Identity #4            │
└─────────────────────────────┘  └────────────────────────┘
```

---

# 10. Run Agent / M402 UI

When Run is clicked:

```text
Run Scholar Compare

Compare papers about:

[ zero knowledge proofs                 ]

Cost

0.08 ANVL

You'll sign a payment authorization.
No MON gas is required.

[ Cancel ] [ Continue → ]
```

When MetaMask opens:

```text
Payment authorization

Scholar Compare
0.08 ANVL

✓ No transaction
✓ No MON gas
✓ Agent runs after authorization

[ Waiting for signature... ]
```

Do not call this a transaction pending state — the user is signing an authorization.

After signing:

```text
✓ Payment authorized

Running Scholar Compare...
```

Execution steps:

```text
✓ Payment authorized
● Searching arXiv
○ Comparing papers
○ Preparing result
```

---

# 11. Scholar Compare Result

The **comparison must be first and visually dominant**.

```text
┌──────────────────────────────────────────────────────────┐
│ SCHOLAR COMPARE                                         │
│                                                          │
│ Key differences                                        │
│                                                          │
│ • Paper A focuses on ...                                │
│ • Paper B approaches the problem through ...            │
│ • Paper C improves ...                                  │
│                                                          │
│ Overall                                                 │
│ ...                                                      │
└──────────────────────────────────────────────────────────┘

Papers compared

┌──────────────────────────────────────────────────────────┐
│ Paper title                                              │
│ Authors · 2024                                           │
│                                                          │
│ Approach                                                 │
│ ...                                                      │
│                                                          │
│ Contribution                                             │
│ ...                                                      │
│                                                          │
│ [ View paper → ]                                         │
└──────────────────────────────────────────────────────────┘
```

If comparison fails:

```text
⚠ Comparison unavailable

The papers were retrieved successfully, but the
comparison could not be generated.

[ Show retrieved papers ]
```

Never hide real retrieved papers.

---

# 12. Price Monitor Result

The **best price must be the first and most visually important result**.

```text
iPhone 14 Pro Max

┌──────────────────────────────────────────────────────────┐
│ 🏆 BEST PRICE                                            │
│                                                          │
│ ₹1,34,900                                               │
│ Flipkart                                                 │
│                                                          │
│ [ View listing → ]                                       │
└──────────────────────────────────────────────────────────┘

Other listings

Amazon
₹1,39,999     ⭐ 4.5     In stock

Flipkart
₹1,34,900     ⭐ 4.4     In stock

Reliance Digital
₹1,41,499     ⭐ 4.3     In stock

Croma
₹1,42,000     ⭐ 4.4     In stock
```

Use a very light purple or mint highlight for the winner, not a giant green SALE style.

Store comparison should be compact:

```text
Store             Price       Rating       Availability
────────────────────────────────────────────────────────
Amazon            ₹139,999    4.5          ● In stock
Flipkart          ₹134,900    4.4          ● In stock
Reliance Digital  ₹141,499    4.3          ● In stock
Croma             ₹142,000    4.4          ● In stock
```

---

# 13. Zepto Workflow UI

Make this feel like an execution console.

```text
Zepto Cart

Tell the agent what you need:

┌──────────────────────────────────────────────────────────┐
│ Add 2 bananas, 1 milk and bread to my Zepto cart.       │
└──────────────────────────────────────────────────────────┘

0.10 ANVL / workflow

[ Build Cart → ]
```

Execution:

```text
Building your cart

✓ Searching bananas
✓ Adding bananas
● Searching milk
○ Adding bread
○ Verifying cart
```

Only show real execution stages.

Result:

```text
┌──────────────────────────────────────────────────────────┐
│ 🛒 CART READY                                            │
│                                                          │
│ 2 × Bananas                                  ₹80         │
│ 1 × Milk                                     ₹65         │
│ 1 × Bread                                    ₹45         │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│ Total                                         ₹190        │
│                                                          │
│ ✓ Cart verified                                           │
│                                                          │
│              [ Continue to Zepto → ]                     │
└──────────────────────────────────────────────────────────┘
```

Clearly state:

> Checkout happens on Zepto.

Do not imply Anvil processed the INR payment.

---

# 14. Staking Page

Do not make this look like a DeFi terminal.

Header:

```text
Back the agents you believe in.

Stake ANVL on an agent and receive a share
of that agent's eligible revenue.
```

Agent card:

```text
Scholar Compare

Total staked
12,450 ANVL

Your stake
500 ANVL

Your pending rewards
12.4 ANVL

[ Stake ] [ Claim ]
```

Use clean financial typography. No candlestick charts.

---

# 15. Identity Page

Identity should feel like verification, not NFT trading.

```text
Agent identities

Every Anvil agent has a verifiable on-chain identity.
```

Rows:

```text
✓ Scholar Search       ERC-8004 #2
✓ Price Monitor        ERC-8004 #3
✓ Scholar Compare      ERC-8004 #4
✓ Echo Bench           ERC-8004 #1
```

Detail:

```text
Identity #4

Agent:
Scholar Compare

Owner:
0x213C...955D

Network:
Monad Testnet

Status:
✓ Verified
```

Provide explorer links where appropriate.

---

# 16. On-chain Status

Use subtle indicators:

```text
● Live on Monad
✓ Verified
Monad Testnet
```

Mint for success/verification.

Do not put huge TESTNET banners across every page.

---

# 17. Buttons

Primary:

```text
Monad purple background
white text
```

Examples:

```text
[ Run Agent → ]
[ Build Cart → ]
[ Connect Wallet ]
```

Secondary:

```text
white
purple border/text
```

Use:

```text
8–10px radius
36–44px height
clear hover state
```

Avoid pill-shaped buttons everywhere.

---

# 18. Cards and Tables

Cards:

```text
background: white
border: 1px solid #E7E7EC
radius: 14–18px
very subtle shadow
```

Tables:

```text
header background: #F8F8FA
row border: #ECECF0
hover: very light purple tint
```

Never use dark table headers.

---

# 19. Loading and Toasts

Use meaningful execution states rather than generic spinners.

Success:

```text
✓ Payment authorized
```

On-chain:

```text
✓ Settlement confirmed on Monad
View transaction →
```

Error:

```text
Couldn't run agent
```

Agent execution:

```text
✓ Payment authorized
✓ Fetching data
● Running agent
○ Preparing result
```

---

# 20. Responsive

Mobile:

- one-column agent cards
- full-width agent input
- full-width primary CTA
- compact navigation
- tables become stacked cards where appropriate

Do not allow the entire page to become horizontally scrollable.

---

# 21. Monad Branding

Monad should be recognizable without making everything purple.

Use Monad purple for:

- Anvil logo accent
- primary buttons
- active nav
- prices
- links
- selected states
- subtle highlights

Use mint for:

- verified
- successful
- live
- completed

Keep the overall canvas white.

The result should feel **Monad-native without looking like a Monad clone**.

---

# 22. Design Principle

Anvil's visual story:

```text
                    ANVIL
                       │
        ┌──────────────┼──────────────┐
        │              │              │
      Agents          Money          Trust
        │              │              │
     Webcmd          ANVL        On-chain identity
        │              │              │
        └──────────────┼──────────────┘
                       │
                     Monad
```

The UI should communicate:

> **Useful first. Crypto underneath.**

---

# 23. Implementation Rules

When implementing:

1. Reuse existing components.
2. Do not rewrite application architecture.
3. Do not change contracts or payment logic.
4. Do not add unnecessary dependencies.
5. Preserve existing functionality.
6. Use existing Tailwind setup if present.
7. Centralize design tokens/colors.
8. Keep the UI white-first.
9. Do not introduce a dark theme.
10. Do not use generic Web3 dashboard templates.
11. Do not use random gradients or stock illustrations.
12. Prioritize marketplace + Price Monitor + Scholar Compare + Zepto workflow.
13. Preserve real on-chain data and real agent results.
14. Never replace real data with mock data for visual purposes.

---

# 24. Demo-first Priority

Polish these flows most:

### Price Monitor

```text
Marketplace
 ↓
Price Monitor
 ↓
Run
 ↓
Sign ANVL
 ↓
Amazon / Flipkart / Reliance / Croma
 ↓
🏆 Best Price
```

### Scholar Compare

```text
Marketplace
 ↓
Scholar Compare
 ↓
Run
 ↓
Sign ANVL
 ↓
Search papers
 ↓
Comparison FIRST
 ↓
Papers
```

### Zepto

```text
Marketplace
 ↓
Zepto Cart
 ↓
Run
 ↓
Sign ANVL
 ↓
Webcmd
 ↓
Cart
 ↓
[ Continue to Zepto → ]
```

### Staking

```text
Agent
 ↓
Stake
 ↓
ANVL
 ↓
Revenue share
```

---

# 25. Final Test

Look at the application for five seconds.

A new user should immediately understand:

> **Anvil is a marketplace for useful AI agents.**

Not:

> "This is a crypto dashboard."

The target is a **real product that happens to have blockchain rails underneath it**.
