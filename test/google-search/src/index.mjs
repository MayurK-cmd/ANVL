import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8000);

// Node 22.18 reads .env natively — no dotenv. Absent file is fine: the missing
// key is reported per-request instead, so the server still starts.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {}

const ENDPOINT = "https://www.googleapis.com/customsearch/v1";

/**
 * Google Search — Programmable Search Engine (Custom Search JSON API).
 *
 * Needs two values, both free to obtain:
 *   GOOGLE_API_KEY  https://console.cloud.google.com/apis/credentials  (enable "Custom Search API")
 *   GOOGLE_CSE_ID   https://programmablesearchengine.google.com/  → set it to "Search the entire web"
 *
 * Free tier is 100 queries/day. Scraping google.com directly is not an option:
 * it is blocked, rate-limited and against their terms.
 */
export async function run(input) {
  const query = String(input.query ?? "").trim();
  if (!query) throw new Error("query is required");

  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) {
    throw new Error(
      "GOOGLE_API_KEY and GOOGLE_CSE_ID must be set in .env — see the README",
    );
  }

  // The API rejects num outside 1..10, so clamp rather than forward a 400.
  const count = Math.min(Math.max(Number(input.count) || 5, 1), 10);

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ key, cx, q: query, num: String(count) });

  // Google can hang; a paid call should fail fast rather than pin the buyer.
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Google API ${response.status}: ${body?.error?.message ?? "request failed"}`,
    );
  }

  return {
    query,
    totalResults: Number(body.searchInformation?.totalResults ?? 0),
    results: (body.items ?? []).map((item) => ({
      title: item.title,
      url: item.link,
      source: item.displayLink,
      snippet: item.snippet,
    })),
  };
}

// ponytail: no payment gate yet. The Store's client already speaks M402 — the
// moment this endpoint answers with 402 + X-PAYMENT-REQUIRED it gets paid, with
// no change on the Store side. Front it with @anvil/m402-sdk once that package
// is extracted (PRD phase 1, item 6).
const server = createServer(async (request, response) => {
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

  const started = Date.now();
  const elapsed = () => `[${((Date.now() - started) / 1000).toFixed(1)}s]`;

  try {
    const result = await run(input);
    send(200, {
      result,
      logs: [
        `${elapsed()} Query: ${result.query}`,
        `${elapsed()} Google returned ${result.results.length} of ~${result.totalResults} results`,
      ],
    });
  } catch (error) {
    send(500, { error: error?.message ?? "agent failed" });
  }
});

// Only listen when run directly, so test.mjs can import run() without a port.
if (import.meta.main) {
  server.listen(PORT, () => {
    console.log(`Google Search listening on http://localhost:${PORT}/send`);
  });
}
