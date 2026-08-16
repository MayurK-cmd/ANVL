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

  return { result: { ok: true, input }, logs: ["[00.0s] Done"] };
}

export function requireAgent(id: string): Agent {
  const agent = getAgent(id);
  if (!agent) {
    throw new Error(`Unknown agent: ${id}`);
  }
  return agent;
}
