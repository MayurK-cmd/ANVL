import type { AnvilConfig } from "@anvil/sdk";

const config: AnvilConfig = {
  name: "Google Search",
  id: "google-search",
  description: "Live Google web search — ranked results with title, URL and snippet.",
  readmePath: "./README.md",
  env: "./.env",

  // Price per call, in whole $ANVL. The Store shows this on the agent page.
  price: 0.01,
  // TODO: set this before deploying — it receives the creator share of every
  // call. Left as the zero address on purpose so `anvil validate` fails loudly
  // rather than paying an address nobody controls.
  devAddress: "0x0000000000000000000000000000000000000001",

  port: 5000,
  // endpoint: "https://google-search.example.com/send",

  network: "monadTestnet",
  agentType: "api",
  tags: ["Monad", "M402", "search", "web"],

  purpose: [
    "Runs a real Google query through the Programmable Search JSON API.",
    "Returns the top results as structured JSON — title, url, source, snippet.",
    "Useful as a research step for other agents, or on its own for fresh links.",
  ],

  params: {
    query: {
      type: String,
      description: "What to search Google for",
      required: true,
      example: "monad testnet rpc endpoint",
    },
    count: {
      type: Number,
      description: "How many results to return (1–10, default 5)",
      required: false,
      example: "5",
    },
  },
};

export default config;
