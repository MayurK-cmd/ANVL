/** File templates for `anvil init`. */

export function configFile({ name, id }) {
  // A type-only import is erased before Node runs this file, so the config
  // loads with nothing installed. Add @anvil/sdk as a devDependency to get
  // editor type-checking; you never need it at runtime.
  return `import type { AnvilConfig } from "@anvil/sdk";

const config: AnvilConfig = {
  name: "${name}",
  id: "${id}",
  description: "One line telling a buyer what this agent does.",
  readmePath: "./README.md",
  env: "./.env",

  // Price per call, in whole $ANVL. The Store shows this on the agent page.
  price: 0.01,
  // The address that receives the creator share.
  devAddress: "0x0000000000000000000000000000000000000000",

  // Where the agent listens. \`endpoint\` wins; \`port\` derives a localhost one.
  port: 8000,
  // endpoint: "https://${id}.example.com/send",

  network: "monadTestnet",
  agentType: "api", // "api" | "browser" | "sitemap"
  tags: ["Monad", "M402"],

  purpose: [
    "Describe what the agent does, one bullet per line.",
    "These render on the agent's Store page.",
  ],

  params: {
    prompt: {
      type: String,
      description: "The input prompt for the agent",
      required: true,
      example: "summarise this repo",
    },
  },

  // Browser agents only — requires agentType: "browser".
  // webcmd: {
  //   command: "${id}",
  //   sites: ["example.com"],
  //   avgExecutionMs: 4200,
  //   requiresAuth: false,
  // },
};

export default config;
`;
}

export function agentFile({ name }) {
  return `import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8000);

/**
 * ${name} — your agent.
 *
 * \`input\` matches the \`params\` in anvil.config.ts. Whatever you return is
 * what the Store playground renders as Execution Output.
 */
async function run(input) {
  return {
    echo: input.prompt,
    at: new Date().toISOString(),
  };
}

// ponytail: no payment gate yet. The Store's client already speaks M402 — the
// moment this endpoint answers with 402 + X-PAYMENT-REQUIRED it gets paid, with
// no change on the Store side. Front it with @anvil/m402-sdk once that package
// is extracted (PRD phase 1, item 6).
createServer(async (request, response) => {
  const send = (status, body) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      // The Store calls this endpoint straight from the browser.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-PAYER, X-PAYMENT",
      "Access-Control-Expose-Headers": "X-PAYMENT-REQUIRED",
    });
    response.end(JSON.stringify(body));
  };

  if (request.method === "OPTIONS") return send(204, {});
  if (request.method !== "POST") return send(405, { error: "POST /send" });

  let input = {};
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return send(400, { error: "invalid JSON body" });
  }

  try {
    const result = await run(input);
    send(200, { result, logs: ["[00.0s] Received input", "[00.0s] Done"] });
  } catch (error) {
    send(500, { error: error?.message ?? "agent failed" });
  }
}).listen(PORT, () => {
  console.log(\`${name} listening on http://localhost:\${PORT}/send\`);
});
`;
}

export function readmeFile({ name, id }) {
  return `# ${name}

## Purpose

Say what this agent does and who it is for.

## Running it

\`\`\`bash
npm start           # serves /send on port 8000
anvil validate      # check anvil.config.ts
anvil deploy -k <key>
\`\`\`

## Payment

The Store client speaks M402: it sends \`X-PAYER\`, expects \`402\` with an
\`X-PAYMENT-REQUIRED\` challenge, signs an EIP-2612 permit, and retries with
\`X-PAYMENT\`. This scaffold answers \`200\` immediately, so calls are free until
you put a payment gate in front of \`run()\`.

## Notes

- Agent id: \`${id}\`
- Network: Monad Testnet (chain id 10143)
- Never commit \`.env\`. \`anvil deploy\` uploads env KEY NAMES only, never values.
`;
}

export function envFile() {
  return `# Values here are never uploaded — anvil deploy reads the key NAMES only,
# so the Store can show which variables the agent expects.
OPENAI_API_KEY=
`;
}

export function packageFile({ id }) {
  return `${JSON.stringify(
    {
      name: id,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: { start: "node src/index.mjs" },
    },
    null,
    2,
  )}\n`;
}

export const gitignoreFile = `node_modules/
.env
`;
