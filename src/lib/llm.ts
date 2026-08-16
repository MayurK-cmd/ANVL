/**
 * LLM provider abstraction — SERVER ONLY (needs ANTHROPIC_API_KEY). Shared by
 * Scholar Compare (paper comparison) and Price Monitor (equivalent-product
 * normalization + best-price selection).
 *
 * Both prompts avoid having the model re-type facts we already have: numeric
 * prices, titles, authors, and URLs stay ours; the model only ever returns
 * indices back into the arrays we sent it, plus prose analysis/reasoning.
 * That makes a hallucinated number structurally impossible, not just unlikely.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-opus-4-8";

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic();
}

// --- Scholar Compare -------------------------------------------------------

const PaperAnalysisSchema = z.object({
  index: z.number().int().describe("0-based index into the papers array this analysis is about"),
  problem: z.string().describe("What problem is the paper trying to solve"),
  approach: z.string().describe("Core methodology or approach"),
  contribution: z.string().describe("What the paper contributes"),
  results: z.string().describe("What the paper demonstrates, based only on the given abstract/metadata"),
  limitations: z.string().describe("Limitations or tradeoffs apparent from the available information"),
});

const ScholarCompareSchema = z.object({
  summary: z.string().describe("Short overview of the research area"),
  analyses: z.array(PaperAnalysisSchema),
  keyDifferences: z.array(z.string()).describe("3-5 short bullets on what fundamentally distinguishes the papers"),
  overall: z.string().describe("Concise synthesis of the comparison"),
});

export type ArxivPaperInput = {
  title: string;
  authors: string[];
  year: number | null;
  url: string;
  abstract: string | null;
};

export type ScholarCompareLLMResult = z.infer<typeof ScholarCompareSchema>;

export async function comparePapers(
  query: string,
  papers: ArxivPaperInput[],
): Promise<ScholarCompareLLMResult> {
  const paperList = papers
    .map((p, i) => {
      const meta = `${i}. "${p.title}" — ${p.authors.join(", ") || "unknown authors"} (${p.year ?? "n.d."}) ${p.url}`;
      const abstract = p.abstract ? `\n   Abstract: ${p.abstract}` : "\n   (no abstract available)";
      return meta + abstract;
    })
    .join("\n\n");

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      "You compare academic papers for a research assistant. Base every claim only on the title, authors, and abstract given below — never invent experimental results, numbers, or claims the text doesn't support. If a paper's abstract is missing, reason conservatively from its title only and say so rather than guessing at its contents.",
    messages: [
      {
        role: "user",
        content: `Research topic: "${query}"\n\nPapers (0-indexed):\n\n${paperList}\n\nFor each paper, analyze its problem, approach, contribution, results/findings, and limitations. Then give the key differences between them and an overall synthesis.`,
      },
    ],
    output_config: { format: zodOutputFormat(ScholarCompareSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Comparison generation failed to parse a structured response");
  }
  return response.parsed_output;
}

// --- Price Monitor -----------------------------------------------------------

const ProductNormalizationSchema = z.object({
  equivalentIndices: z
    .array(z.number().int())
    .describe(
      "0-based indices into the listings array that represent the SAME product and variant (same model, storage, color, and condition — new vs. renewed/refurbished counts as a different variant). If the query doesn't specify a variant, pick the variant shared by the most listings.",
    ),
  bestIndex: z
    .number()
    .int()
    .nullable()
    .describe("0-based index into the listings array with the lowest valid price among equivalentIndices. Null if none has a usable price."),
  variantNote: z
    .string()
    .nullable()
    .describe(
      "One sentence noting any variant/condition distinctions found (e.g. excluded a different storage size or a renewed listing). Null if all listings were already equivalent.",
    ),
});

export type ProductListingInput = {
  store: string;
  title: string;
  price: number | null;
  currency: string | null;
  availability: string | null;
};

export type ProductNormalizationResult = z.infer<typeof ProductNormalizationSchema>;

export async function normalizeListings(
  query: string,
  listings: ProductListingInput[],
): Promise<ProductNormalizationResult> {
  const listText = listings
    .map(
      (l, i) =>
        `${i}. [${l.store}] "${l.title}" — ${l.price != null ? `${l.currency ?? ""} ${l.price}` : "price unavailable"} (${l.availability ?? "availability unknown"})`,
    )
    .join("\n");

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system:
      "You compare shopping listings for price-comparison. Group only genuinely equivalent listings (same product, storage, color, and condition) — a cheaper renewed/refurbished item is NOT a better price than a new one unless the user asked for renewed. Never invent a price; only compare the prices given.",
    messages: [
      {
        role: "user",
        content: `User searched for: "${query}"\n\nListings (0-indexed):\n${listText}\n\nWhich listings are equivalent to each other, and which has the best (lowest) price among the equivalent set?`,
      },
    ],
    output_config: { format: zodOutputFormat(ProductNormalizationSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Product normalization failed to parse a structured response");
  }
  return response.parsed_output;
}
