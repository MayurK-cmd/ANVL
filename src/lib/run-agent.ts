import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { getAgent, type Agent } from "@/data/agents";
import { comparePapers, normalizeListings, type ArxivPaperInput } from "@/lib/llm";

export type AgentResult = {
  result: unknown;
  logs: string[];
};

type Paper = { title: string; authors: string[]; year: number | null; url: string };

type ArxivRow = {
  id: string;
  title: string;
  authors: string;
  published: string;
  primary_category: string;
  url: string;
};

type ArxivPaperDetailRow = {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  published: string;
  updated: string;
  primary_category: string;
  categories: string;
  comment: string;
  pdf: string;
  url: string;
};

type ProductListing = {
  store: string;
  title: string;
  price: number | null;
  currency: string | null;
  rating: number | null;
  reviewCount: number | null;
  availability: string | null;
  seller: string | null;
  url: string;
};

type AmazonRow = {
  asin: string;
  title: string;
  product_url: string;
  price_text: string | null;
  rating_value: number | null;
  review_count: number | null;
};

/** Flipkart, Reliance, and Croma adapters all emit this identical shape. */
type StoreRow = {
  title: string;
  price: number | null;
  currency: string | null;
  rating: number | null;
  reviewCount: number | null;
  availability: string | null;
  seller: string | null;
  url: string | null;
};

const execFileAsync = promisify(execFile);

/**
 * The webcmd CLI's own entry file, invoked as `node <entry> ...` (array args,
 * no shell) rather than the `webcmd` binary name — on Windows that's a .cmd
 * shim, which only runs through cmd.exe, and `query` below is untrusted user
 * input that must never pass through a shell.
 *
 * Located via a raw filesystem read, not `require.resolve`/`import` — either
 * of those is a static reference Turbopack traces at build time, dragging in
 * webcmd's whole dependency graph (including a native binding it can't
 * bundle) even though nothing here ever imports the package as a module.
 */
function resolveWebcmdEntry(): string {
  const pkgPath = join(process.cwd(), "node_modules", "@agentrhq", "webcmd", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    main?: string;
    bin?: string | Record<string, string>;
  };
  const rel = typeof pkg.bin === "string" ? pkg.bin : (pkg.bin?.webcmd ?? pkg.main);
  if (!rel) throw new Error("could not resolve @agentrhq/webcmd entry point");
  return join(dirname(pkgPath), rel);
}

const webcmdEntry = resolveWebcmdEntry();

/**
 * Real Webcmd adapter: `webcmd arxiv search` (PUBLIC strategy — hits arXiv's
 * own API, no browser at all). Targets arXiv rather than Google Scholar:
 * Scholar hard-blocks headless/API traffic on the first request.
 */
async function searchArxiv(query: string, limit = 3): Promise<Paper[]> {
  const { stdout } = await execFileAsync(process.execPath, [
    webcmdEntry,
    "arxiv",
    "search",
    query,
    "-f",
    "json",
    "--limit",
    String(limit),
  ]);
  const rows = JSON.parse(stdout) as ArxivRow[];
  return rows.map((row) => ({
    title: row.title,
    authors: row.authors.split(",").map((a) => a.trim()).filter(Boolean),
    year: row.published ? Number(row.published.slice(0, 4)) : null,
    url: row.url,
  }));
}

/** Extract a numeric value + currency token from a free-form price string like "INR 13,383.46" or "$549". */
function parsePrice(text: string | null): { value: number | null; currency: string | null } {
  if (!text) return { value: null, currency: null };
  const match = text.match(/^([^\d]*)\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return { value: null, currency: null };
  const value = Number(match[2].replace(/,/g, ""));
  const rawCurrency = match[1].trim();
  const currency = rawCurrency === "$" ? "USD" : rawCurrency === "₹" ? "INR" : rawCurrency || null;
  return { value: Number.isFinite(value) ? value : null, currency };
}

/**
 * Real Webcmd adapter: `webcmd amazon search` (drives a stealth browser —
 * Amazon has no public search API). Flakier than arXiv in practice: it can
 * fail outright on a bot-check hiccup, and price fields are sometimes null or
 * in a currency picked by network geolocation rather than USD. Callers should
 * retry once before giving up. Amazon's search command exposes no
 * availability/seller field, so those are always null here.
 */
async function searchAmazon(query: string, limit = 3): Promise<ProductListing[]> {
  const { stdout } = await execFileAsync(process.execPath, [
    webcmdEntry,
    "amazon",
    "search",
    query,
    "-f",
    "json",
    "--limit",
    String(limit),
  ]);
  const rows = JSON.parse(stdout) as AmazonRow[];
  return rows.map((row) => {
    const { value, currency } = parsePrice(row.price_text);
    return {
      store: "Amazon",
      title: row.title,
      price: value,
      currency,
      rating: row.rating_value ?? null,
      reviewCount: row.review_count ?? null,
      availability: null,
      seller: null,
      url: row.product_url,
    };
  });
}

/**
 * Shared by Flipkart, Reliance Digital, and Croma — all three adapters are
 * `browser: false` (plain public HTTP, no cookies/session) and emit the same
 * `StoreRow` shape, so one generic caller covers all three instead of
 * duplicating the same execFile + map three times.
 */
async function searchStoreAdapter(site: string, storeName: string, query: string, limit: number): Promise<ProductListing[]> {
  const { stdout } = await execFileAsync(process.execPath, [
    webcmdEntry,
    site,
    "search",
    query,
    "-f",
    "json",
    "--limit",
    String(limit),
  ]);
  const rows = JSON.parse(stdout) as StoreRow[];
  return rows.map((row) => ({
    store: storeName,
    title: row.title,
    price: row.price ?? null,
    currency: row.currency ?? null,
    rating: row.rating ?? null,
    reviewCount: row.reviewCount ?? null,
    availability: row.availability ?? null,
    seller: row.seller ?? null,
    url: row.url ?? "",
  }));
}

/** `webcmd flipkart search` — plain unauthenticated fetch of the SSR search page, whose HTML embeds a full product-data JSON blob. No seller field on the search results page. */
function searchFlipkart(query: string, limit = 3): Promise<ProductListing[]> {
  return searchStoreAdapter("flipkart", "Flipkart", query, limit);
}

/** `webcmd reliance search` — plain public JSON API (`ext/raven-api/catalog/v1.0/products`), no browser. No review-count field exposed by this API. */
function searchReliance(query: string, limit = 3): Promise<ProductListing[]> {
  return searchStoreAdapter("reliance", "Reliance Digital", query, limit);
}

/** `webcmd croma search` — plain public JSON API (`searchservices/v1/search`), no browser. No sitewide availability boolean exposed (stock is per-store, not a simple flag). */
function searchCroma(query: string, limit = 3): Promise<ProductListing[]> {
  return searchStoreAdapter("croma", "Croma", query, limit);
}

type ZeptoSearchRow = {
  rank: number;
  product_id: string;
  title: string;
  brand: string;
  pack_size: string;
  price: number | null;
  mrp: number | null;
  availability: string;
  url: string;
};

type ZeptoCartRow = {
  rank: number;
  product_id: string;
  title: string;
  pack_size: string;
  quantity: number;
  price: number | null;
  mrp: number | null;
  availability: string;
};

type ZeptoCheckoutRow = { ok: boolean; stage: string; item_count: number; next_action: string; url: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One `webcmd zepto <...> -f json` call — deliberately no `--session` flag.
 * The cart lives in the Zepto profile's own localStorage (domain-scoped, not
 * session-scoped — confirmed by reading it back with a brand new session),
 * so nothing needs a shared session to see earlier steps' additions. Forcing
 * every step through the same tab/session was observed to make later steps
 * in a run measurably less reliable than the same call made fresh (likely
 * accumulating page cruft across several navigations in one tab); a fresh
 * default lease per call was reliable across repeated testing.
 *
 * Throws on any adapter error (typed errors, timeouts, empty results alike)
 * — callers decide whether that's retryable.
 */
async function webcmdZepto<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(process.execPath, [webcmdEntry, "zepto", ...args, "-f", "json"]);
  return JSON.parse(stdout) as T;
}

/**
 * "Add 2 bananas, 1 milk and bread to my Zepto cart." -> [{query:"bananas",
 * quantity:2}, {query:"milk", quantity:1}, {query:"bread", quantity:1}].
 *
 * Plain regex, not an LLM call: grocery requests are formulaic enough that a
 * parser is more reliable than a model call on the critical path, and it
 * keeps this agent working even while the Anthropic key is down.
 */
function parseGroceryRequest(text: string): Array<{ query: string; quantity: number }> {
  const body = text
    .trim()
    .replace(/^(please\s+)?(add|buy|get|order|purchase)\s+/i, "")
    .replace(/\s*(to\s+my\s+)?(zepto\s+)?cart\.?\s*$/i, "")
    .trim();

  return body
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map((segment) => segment.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^(\d+)\s*(?:x\s*)?(.+)$/i);
      if (!match) return { query: segment, quantity: 1 };
      const quantity = Math.max(1, Math.min(12, parseInt(match[1], 10)));
      return { query: match[2].trim(), quantity };
    })
    .filter((item) => item.query.length > 0);
}

/**
 * Zepto's search results render as skeleton placeholders for a moment after
 * navigation; hitting `evaluate` before hydration finishes reads an empty
 * page, not an out-of-stock product. Observed in practice: the second or
 * third attempt against the same warm session succeeds.
 */
const ZEPTO_SEARCH_ATTEMPTS = 5;

async function searchZeptoWithRetry(
  query: string,
  logs: string[],
  stamp: () => string,
): Promise<ZeptoSearchRow[]> {
  for (let attempt = 1; attempt <= ZEPTO_SEARCH_ATTEMPTS; attempt += 1) {
    try {
      const rows = await webcmdZepto<ZeptoSearchRow[]>(["search", query, "--limit", "5"]);
      if (rows.length > 0) return rows;
    } catch {
      // fall through to retry
    }
    if (attempt < ZEPTO_SEARCH_ATTEMPTS) {
      logs.push(`${stamp()} Zepto search "${query}": no results yet, retrying…`);
      await sleep(4000);
    }
  }
  return [];
}

/**
 * Adds one item and reads the cart back to confirm it actually landed —
 * `add-to-cart` has been observed to report `ok: true` on a click that never
 * reached the page's real add button (recommendation-carousel buttons share
 * the same visible text). The cart read is the only trustworthy signal.
 */
const ZEPTO_ADD_ATTEMPTS = 4;

async function addToCartAndVerify(
  row: ZeptoSearchRow,
  quantity: number,
  logs: string[],
  stamp: () => string,
): Promise<ZeptoCartRow | null> {
  // Snapshot first: the cart may not start empty (a prior run, or the same
  // product requested twice), so "verified" has to mean the quantity went up
  // by at least what we asked for, not just "is present at or above N".
  const before = await webcmdZepto<ZeptoCartRow[]>(["cart"]).catch(() => [] as ZeptoCartRow[]);
  const startQty = before.find((r) => r.product_id === row.product_id)?.quantity ?? 0;

  for (let attempt = 1; attempt <= ZEPTO_ADD_ATTEMPTS; attempt += 1) {
    try {
      await webcmdZepto(["add-to-cart", row.url, "--quantity", String(quantity)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "add-to-cart failed";
      logs.push(`${stamp()} ${row.title}: add-to-cart error (attempt ${attempt}) — ${message}`);
      if (attempt < ZEPTO_ADD_ATTEMPTS) await sleep(3000);
      continue;
    }
    const cart = await webcmdZepto<ZeptoCartRow[]>(["cart"]).catch(() => [] as ZeptoCartRow[]);
    const line = cart.find((r) => r.product_id === row.product_id);
    if (line && line.quantity - startQty >= quantity) {
      logs.push(`${stamp()} ${row.title}: verified in cart (qty ${line.quantity})`);
      return line;
    }
    logs.push(`${stamp()} ${row.title}: not reflected in cart yet (attempt ${attempt}), retrying…`);
    if (attempt < ZEPTO_ADD_ATTEMPTS) await sleep(3000);
  }
  return null;
}

/** Run one store's search with an optional single retry; never throws — reports status instead. */
async function tryStore(
  name: string,
  fn: () => Promise<ProductListing[]>,
  logs: string[],
  stamp: () => string,
  retryOnce: boolean,
): Promise<{ status: "success" | "unavailable"; listings: ProductListing[] }> {
  try {
    const listings = await fn();
    logs.push(`${stamp()} ${name}: ${listings.length} result(s)`);
    return { status: "success", listings };
  } catch (error) {
    if (retryOnce) {
      logs.push(`${stamp()} ${name}: first attempt failed, retrying once…`);
      try {
        const listings = await fn();
        logs.push(`${stamp()} ${name}: ${listings.length} result(s) (after retry)`);
        return { status: "success", listings };
      } catch (retryError) {
        const message = retryError instanceof Error ? retryError.message : "unknown error";
        logs.push(`${stamp()} ${name}: unavailable — ${message}`);
        return { status: "unavailable", listings: [] };
      }
    }
    const message = error instanceof Error ? error.message : "unknown error";
    logs.push(`${stamp()} ${name}: unavailable — ${message}`);
    return { status: "unavailable", listings: [] };
  }
}

/** `webcmd arxiv paper <id>` — abstract, categories, and PDF link that `search` doesn't expose. */
async function fetchArxivPaperDetail(id: string): Promise<ArxivPaperInput> {
  const { stdout } = await execFileAsync(process.execPath, [webcmdEntry, "arxiv", "paper", id, "-f", "json"]);
  const rows = JSON.parse(stdout) as ArxivPaperDetailRow[];
  const row = rows[0];
  if (!row) throw new Error(`arxiv paper ${id} not found`);
  return {
    title: row.title,
    authors: row.authors.split(",").map((a) => a.trim()).filter(Boolean),
    year: row.published ? Number(row.published.slice(0, 4)) : null,
    url: row.url,
    abstract: row.abstract || null,
  };
}

function extractArxivId(url: string): string | null {
  const match = url.match(/abs\/([^/?]+)/);
  return match ? match[1] : null;
}

export async function runAgent(
  agent: Agent,
  input: Record<string, unknown>,
): Promise<AgentResult> {
  if (agent.id === "echo-v1") {
    const prompt = String(input.prompt ?? "");
    return {
      result: { echo: prompt, at: new Date().toISOString() },
      logs: ["[00.0s] Received prompt", "[00.0s] Echo ready"],
    };
  }

  if (agent.id === "scholar-search-v1") {
    const query = String(input.query ?? "");
    const start = Date.now();
    const stamp = () => `[${((Date.now() - start) / 1000).toFixed(1)}s]`;
    const logs = [`${stamp()} webcmd arxiv search "${query}"`];
    const papers = await searchArxiv(query);
    logs.push(`${stamp()} Parsed ${papers.length} result(s)`, `${stamp()} Done`);
    return { result: { papers }, logs };
  }

  if (agent.id === "price-monitor-v1") {
    const product = String(input.product ?? "");
    const start = Date.now();
    const stamp = () => `[${((Date.now() - start) / 1000).toFixed(1)}s]`;
    const logs = [`${stamp()} Searching Amazon + Flipkart + Reliance Digital + Croma for "${product}"`];

    const [amazon, flipkart, reliance, croma] = await Promise.all([
      tryStore("Amazon", () => searchAmazon(product), logs, stamp, true),
      tryStore("Flipkart", () => searchFlipkart(product), logs, stamp, false),
      tryStore("Reliance Digital", () => searchReliance(product), logs, stamp, false),
      tryStore("Croma", () => searchCroma(product), logs, stamp, false),
    ]);

    const listings = [...amazon.listings, ...flipkart.listings, ...reliance.listings, ...croma.listings];
    const sources = {
      amazon: amazon.status,
      flipkart: flipkart.status,
      relianceDigital: reliance.status,
      croma: croma.status,
    };

    if (listings.length === 0) {
      logs.push(`${stamp()} ERROR: all stores unavailable`);
      throw new Error("All stores were unavailable for this search");
    }

    let bestPrice: { price: number; currency: string | null; store: string; url: string } | null = null;
    let variantNote: string | null = null;

    try {
      const normalization = await normalizeListings(
        product,
        listings.map((l) => ({
          store: l.store,
          title: l.title,
          price: l.price,
          currency: l.currency,
          availability: l.availability,
        })),
      );
      variantNote = normalization.variantNote;
      const best = normalization.bestIndex != null ? listings[normalization.bestIndex] : undefined;
      if (best && best.price != null) {
        bestPrice = { price: best.price, currency: best.currency, store: best.store, url: best.url };
      }
      logs.push(`${stamp()} Compared ${normalization.equivalentIndices.length} equivalent listing(s)`);
    } catch (error) {
      // LLM comparison failing shouldn't sink an otherwise-real run — fall
      // back to plain lowest-price-among-all, without variant normalization.
      const message = error instanceof Error ? error.message : "comparison failed";
      logs.push(`${stamp()} Comparison unavailable: ${message}`);
      const priced = listings.filter((l): l is ProductListing & { price: number } => l.price != null);
      if (priced.length) {
        const cheapest = priced.reduce((a, b) => (b.price < a.price ? b : a));
        bestPrice = { price: cheapest.price, currency: cheapest.currency, store: cheapest.store, url: cheapest.url };
        variantNote = "LLM comparison unavailable — showing the lowest listed price without variant normalization.";
      }
    }

    if (bestPrice) {
      const amount = bestPrice.currency ? `${bestPrice.currency} ${bestPrice.price}` : String(bestPrice.price);
      logs.push(`${stamp()} 🏆 Best price: ${amount} — ${bestPrice.store}`);
    }
    logs.push(`${stamp()} Done`);

    // bestPrice deliberately comes first — it's the answer to the question
    // being asked; everything after it is supporting detail.
    return { result: { bestPrice, product, listings, sources, variantNote }, logs };
  }

  if (agent.id === "scholar-compare-v1") {
    const query = String(input.query ?? "");
    // Playground form fields are always strings, including untouched
    // optional ones ("") — treat that the same as unset, not as 0.
    const rawLimit = input.limit;
    const requestedLimit = rawLimit === "" || rawLimit == null ? 3 : Number(rawLimit);
    const limit = Number.isFinite(requestedLimit) ? Math.min(5, Math.max(1, Math.round(requestedLimit))) : 3;

    const start = Date.now();
    const stamp = () => `[${((Date.now() - start) / 1000).toFixed(1)}s]`;
    const logs = [`${stamp()} webcmd arxiv search "${query}"`];

    const candidates = await searchArxiv(query, Math.max(limit, 5));
    if (candidates.length === 0) {
      throw new Error("No relevant papers were found for this query.");
    }

    const selected = candidates.slice(0, limit);
    logs.push(`${stamp()} Selected ${selected.length} paper(s), fetching abstracts…`);

    const detailed: ArxivPaperInput[] = await Promise.all(
      selected.map(async (p) => {
        const id = extractArxivId(p.url);
        if (!id) return { ...p, abstract: null };
        try {
          return await fetchArxivPaperDetail(id);
        } catch {
          return { ...p, abstract: null };
        }
      }),
    );

    logs.push(`${stamp()} Comparing ${detailed.length} paper(s) with the LLM…`);

    try {
      const comparison = await comparePapers(query, detailed);
      const papers = detailed.map((p, i) => {
        const analysis = comparison.analyses.find((a) => a.index === i);
        return {
          title: p.title,
          authors: p.authors,
          year: p.year,
          url: p.url,
          problem: analysis?.problem ?? null,
          approach: analysis?.approach ?? null,
          contribution: analysis?.contribution ?? null,
          results: analysis?.results ?? null,
          limitations: analysis?.limitations ?? null,
        };
      });
      logs.push(`${stamp()} Done`);
      // comparison deliberately comes first — it's the answer to the
      // question being asked; the retrieved papers are supporting evidence.
      return {
        result: {
          comparison: {
            summary: comparison.summary,
            keyDifferences: comparison.keyDifferences,
            overall: comparison.overall,
          },
          papers,
          query,
          papersCompared: papers.length,
          status: "complete",
        },
        logs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Comparison generation failed.";
      logs.push(`${stamp()} Comparison failed: ${message}`);
      // comparison is null, but still first — the shape stays predictable
      // whether or not the LLM succeeded, and the real papers are never lost.
      return {
        result: {
          comparison: null,
          papers: detailed.map((p) => ({ title: p.title, authors: p.authors, year: p.year, url: p.url })),
          query,
          papersCompared: detailed.length,
          status: "partial",
          error: message,
        },
        logs,
      };
    }
  }

  if (agent.id === "zepto-cart-v1") {
    const request = String(input.request ?? "");
    const start = Date.now();
    const stamp = () => `[${((Date.now() - start) / 1000).toFixed(1)}s]`;

    const wanted = parseGroceryRequest(request);
    if (wanted.length === 0) {
      throw new Error('Could not find any items in that request. Try "Add 2 bananas and 1 milk to my Zepto cart."');
    }

    const logs = [`${stamp()} Parsed ${wanted.length} item(s): ${wanted.map((w) => `${w.quantity}x ${w.query}`).join(", ")}`];

    const added: ZeptoCartRow[] = [];
    const failures: Array<{ query: string; reason: string }> = [];

    for (const item of wanted) {
      const results = await searchZeptoWithRetry(item.query, logs, stamp);
      if (results.length === 0) {
        logs.push(`${stamp()} ${item.query}: no Zepto products found`);
        failures.push({ query: item.query, reason: "no products found" });
        continue;
      }
      const pick = results[0];
      logs.push(`${stamp()} ${item.query}: selected "${pick.title}" (${pick.pack_size || "pack size n/a"})`);

      const line = await addToCartAndVerify(pick, item.quantity, logs, stamp);
      if (!line) {
        failures.push({ query: item.query, reason: `could not verify "${pick.title}" in cart` });
        continue;
      }
      added.push(line);
    }

    if (added.length === 0) {
      logs.push(`${stamp()} ERROR: no items could be added to the Zepto cart`);
      throw new Error("Could not add any items to the Zepto cart");
    }

    const items = added.map((row) => ({
      title: row.title,
      quantity: row.quantity,
      unitPrice: row.price,
      lineTotal: row.price != null ? Number((row.price * row.quantity).toFixed(2)) : null,
    }));
    const total = items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0);

    logs.push(`${stamp()} Cart verified: ${added.length}/${wanted.length} item(s) added, total ₹${total}`);

    // Zepto's own checkout — never placed, never paid. This only opens the
    // real checkout review page in the same browser session so the user can
    // take over; a login-gated account surfaces as a handoff, not a failure.
    let checkout: {
      available: boolean;
      type: "zepto_session" | "login_required" | "unavailable";
      url?: string;
      label: string;
    };
    try {
      const result = await webcmdZepto<ZeptoCheckoutRow[]>(["checkout"]);
      const row = result[0];
      checkout = { available: true, type: "zepto_session", url: row?.url, label: "Continue to Zepto" };
      logs.push(`${stamp()} Checkout ready (stage: ${row?.stage ?? "cart"}) — stopping before payment`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "checkout unavailable";
      if (/AUTH_REQUIRED|log ?in/i.test(message)) {
        checkout = {
          available: false,
          type: "login_required",
          url: "https://www.zepto.com/?cart=open",
          label: "Log in to Zepto to continue",
        };
        logs.push(`${stamp()} Checkout requires Zepto login — handing off without opening checkout`);
      } else {
        checkout = { available: false, type: "unavailable", label: "Continue to Zepto" };
        logs.push(`${stamp()} Checkout preview unavailable: ${message}`);
      }
    }

    logs.push(`${stamp()} Done`);

    return {
      result: {
        workflow: "zepto-cart-v1",
        status: failures.length === 0 ? "ready_for_checkout" : "partial",
        items,
        total: Number(total.toFixed(2)),
        currency: "INR",
        checkout,
        failures,
      },
      logs,
    };
  }

  return { result: { ok: true, input }, logs: ["[00.0s] Done"] };
}

/**
 * Brings the Zepto browser session forward so the user can pick up checkout
 * where the agent left off — the same persistent profile the agent just used
 * (cart state lives in that profile's localStorage, not in any one session
 * id). Never touches payment, address, or order state; `place-order` is
 * never called here or anywhere else in this codebase.
 */
export async function openZeptoSession(
  mode: "checkout" | "login",
): Promise<{ ok: boolean; stage?: string; url?: string; message?: string }> {
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      webcmdEntry,
      "zepto",
      mode,
      "-f",
      "json",
      "--window",
      "foreground",
      "--keep-tab",
      "true",
    ]);
    if (mode === "login") {
      const [row] = JSON.parse(stdout) as Array<{ status: string; logged_in: boolean }>;
      return { ok: Boolean(row?.logged_in), stage: row?.status, url: "https://www.zepto.com" };
    }
    const [row] = JSON.parse(stdout) as ZeptoCheckoutRow[];
    return { ok: Boolean(row?.ok), stage: row?.stage, url: row?.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "could not open Zepto";
    return { ok: false, message };
  }
}

export function requireAgent(id: string): Agent {
  const agent = getAgent(id);
  if (!agent) {
    throw new Error(`Unknown agent: ${id}`);
  }
  return agent;
}
