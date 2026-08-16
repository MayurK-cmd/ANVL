export type AgentType = "api" | "browser" | "sitemap";

export type AgentParam = {
  name: string;
  type: "string" | "number";
  description: string;
  required: boolean;
  example: string;
};

export type Agent = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  type: AgentType;
  owner: string;
  price: number;
  amount: string;
  /** Real on-chain total (formatted, e.g. "0.5000") once `withOnChainData` overlays it; "0.0000" until then. */
  staked: string;
  /** Real ERC-8004 token id, verified live against IdentityRegistry; null until registered. */
  identityTokenId?: number | null;
  avgResponse: string;
  purpose: string[];
  framework: string[];
  params: AgentParam[];
  envKeys: string[];
  /** Set on uploaded agents: the developer's own M402 endpoint. */
  endpoint?: string;
  /** Rendered on the agent page when the upload carried a README. */
  readme?: string;
  /**
   * "workflow" agents share the exact same M402/AgentRegistry payment
   * substrate as a Store agent (same `getAgent`/`requireAgent` lookup, same
   * `/api/agents/[id]/send` route) but chain multiple real-world steps
   * (search, add to cart, verify, hand off) toward one outcome rather than
   * answering a single query — so they're surfaced under Workflows, not the
   * Store grid. Undefined means "agent" (the default, unchanged).
   */
  category?: "workflow";
  webcmd?: {
    command: string;
    sites: string[];
    avgExecutionMs: number;
    requiresAuth: boolean;
  };
};

export const agents: Agent[] = [
  {
    id: "echo-v1",
    name: "Echo Bench",
    description:
      "Repeats your prompt as structured JSON. Use it to test the M402 pay-then-run loop.",
    tags: ["API", "Debug", "M402"],
    type: "api",
    owner: "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c",
    price: 0.01,
    amount: "10000",
    staked: "0.0000",
    avgResponse: "18ms",
    purpose: [
      "Verify HTTP 402 → sign → retry without a real backend.",
      "Returns the prompt, a timestamp, and the settlement id.",
    ],
    framework: ["Runtime: Next.js route", "Payment: local M402 (dev signature)"],
    params: [
      {
        name: "prompt",
        type: "string",
        description: "Text the agent echoes back",
        required: true,
        example: "forge a summary of this sentence",
      },
    ],
    envKeys: [],
  },
  {
    id: "scholar-search-v1",
    name: "Scholar Search",
    description:
      "Search arXiv and return structured paper metadata via a real Webcmd adapter (webcmd arxiv search).",
    tags: ["Research", "Browser Agent", "Webcmd"],
    type: "browser",
    owner: "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c",
    price: 0.03,
    amount: "30000",
    staked: "0.0000",
    avgResponse: "1.8s",
    purpose: [
      "Find academic papers from a query.",
      "Returns title, authors, year, and URL for each hit.",
    ],
    framework: ["Runtime: webcmd arxiv search (live, PUBLIC API)", "Payment: M402 settling on Monad Testnet"],
    params: [
      {
        name: "query",
        type: "string",
        description: "Search query for academic papers",
        required: true,
        example: "transformer architectures",
      },
    ],
    envKeys: [],
    webcmd: {
      command: "arxiv search",
      sites: ["arxiv.org"],
      avgExecutionMs: 1800,
      requiresAuth: false,
    },
  },
  {
    id: "price-monitor-v1",
    name: "Price Monitor",
    description:
      "Search Amazon, Flipkart, Reliance Digital, and Croma for a product, normalize equivalent listings with an LLM, and return the best comparable price.",
    tags: ["Shopping", "Browser Agent", "Webcmd"],
    type: "browser",
    owner: "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c",
    price: 0.05,
    amount: "50000",
    staked: "0.0000",
    avgResponse: "~6s",
    purpose: [
      "Search a product by name across Amazon, Flipkart, Reliance Digital, and Croma.",
      "Normalizes listings (variant, condition) and returns the best comparable price, not just the cheapest.",
    ],
    framework: [
      "Runtime: webcmd amazon search (live browser) + flipkart/reliance/croma search (public, no browser)",
      "Comparison: Claude API — groups equivalent listings, picks best price, flags variant differences",
      "Payment: M402 settling on Monad Testnet",
    ],
    params: [
      {
        name: "product",
        type: "string",
        description: "Product name to search for",
        required: true,
        example: "wireless mouse",
      },
    ],
    envKeys: [],
    webcmd: {
      command: "amazon search, flipkart search, reliance search, croma search",
      sites: ["amazon.com", "flipkart.com", "reliancedigital.in", "croma.com"],
      avgExecutionMs: 6000,
      requiresAuth: false,
    },
  },
  {
    id: "scholar-compare-v1",
    name: "Scholar Compare",
    description:
      "Find academic papers on a topic and produce a structured comparison of their approaches, contributions, and limitations.",
    tags: ["Research", "Academic", "Browser Agent", "Webcmd"],
    type: "browser",
    owner: "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c",
    price: 0.08,
    amount: "80000",
    staked: "0.0000",
    avgResponse: "~15s",
    purpose: [
      "Search arXiv, select up to 5 relevant papers, and retrieve their abstracts.",
      "Compares problem, approach, contribution, results, and limitations, plus key differences and an overall synthesis.",
    ],
    framework: [
      "Runtime: webcmd arxiv search + webcmd arxiv paper (live, PUBLIC API)",
      "Comparison: Claude API — analysis is grounded in retrieved abstracts, never fabricated",
      "Payment: M402 settling on Monad Testnet",
    ],
    params: [
      {
        name: "query",
        type: "string",
        description: "Research topic to compare papers on",
        required: true,
        example: "zero knowledge proofs",
      },
      {
        name: "limit",
        type: "number",
        description: "Number of papers to compare (1-5, default 3)",
        required: false,
        example: "3",
      },
    ],
    envKeys: [],
    webcmd: {
      command: "arxiv search, arxiv paper",
      sites: ["arxiv.org"],
      avgExecutionMs: 15000,
      requiresAuth: false,
    },
  },
  {
    id: "zepto-cart-v1",
    name: "Zepto Cart",
    description:
      "Parse a natural-language grocery request, search Zepto, add matching products to your cart, and verify the real cart before handing you off to Zepto to check out.",
    tags: ["Shopping", "Browser Agent", "Webcmd"],
    type: "browser",
    category: "workflow",
    owner: "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c",
    price: 0.06,
    amount: "60000",
    staked: "0.0000",
    avgResponse: "~30s",
    purpose: [
      "Turn a plain-English grocery list into real Zepto cart contents.",
      "Reads the actual cart back to confirm what was added, then hands off to Zepto for checkout — never pays, never places the order.",
    ],
    framework: [
      "Runtime: webcmd zepto search + add-to-cart + cart + checkout (live browser, session-bound)",
      "Payment: M402 settling on Monad Testnet — pays for running the agent, not for the groceries",
    ],
    params: [
      {
        name: "request",
        type: "string",
        description: "Natural-language grocery request",
        required: true,
        example: "Add 2 bananas, 1 milk and bread to my Zepto cart.",
      },
    ],
    envKeys: [],
    webcmd: {
      command: "zepto search, zepto add-to-cart, zepto cart, zepto checkout",
      sites: ["zepto.com"],
      avgExecutionMs: 30000,
      requiresAuth: true,
    },
  },
];

export function getAgent(id: string): Agent | undefined {
  return agents.find((agent) => agent.id === id);
}

export function filterAgents(
  query: string,
  type: string,
  list: Agent[] = agents,
): Agent[] {
  const q = query.trim().toLowerCase();
  return list.filter((agent) => {
    const typeOk =
      type === "all" ||
      (type === "api" && agent.type === "api") ||
      (type === "browser" && agent.type === "browser") ||
      (type === "sitemap" && agent.type === "sitemap");
    if (!typeOk) return false;
    if (!q) return true;
    const hay = `${agent.name} ${agent.description} ${agent.tags.join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
}
