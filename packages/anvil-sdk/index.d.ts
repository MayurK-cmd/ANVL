/**
 * @anvil/sdk — the shape of `anvil.config.ts`.
 *
 * This file is the schema. `index.js` validates against it; keep the two in
 * step by hand — the package is deliberately build-free so it can be imported
 * straight from node_modules by Node's type stripper.
 */

export type AgentType = "api" | "browser" | "sitemap";

/** `String` / `Number` (as in the PRD) or the lowercase names. */
export type ParamType = StringConstructor | NumberConstructor | "string" | "number";

export interface AnvilParam {
  type: ParamType;
  description: string;
  required?: boolean;
  /** Shown as the input placeholder in the Store playground. */
  example?: string;
}

export interface AnvilWebcmdConfig {
  /** Name of the learned Webcmd command. */
  command: string;
  /** URIs of referenced sitemaps (ipfs:// preferred). */
  sitemapRefs?: string[];
  /** Whether the workflow needs credentials. */
  requiresAuth?: boolean;
  /** Sites the command touches — shown on the agent page. */
  sites?: string[];
  avgExecutionMs?: number;
}

export interface AnvilConfig {
  /** Project name. Also the source of the agent id unless `id` is set. */
  name: string;
  /** Stable agent id. Defaults to a slug of `name`. */
  id?: string;
  description: string;
  /** Path to the README rendered on the agent page. */
  readmePath?: string;
  /** Path to the .env file. Only the KEYS are ever read — never the values. */
  env?: string;
  params: Record<string, AnvilParam>;
  /** Port the agent listens on. Used to derive `endpoint` if unset. */
  port?: number;
  /** Public URL of the agent's M402 endpoint. */
  endpoint?: string;
  /** Price per call, in whole $ANVL (e.g. 0.01). */
  price: number;
  /** Address that receives the creator share. */
  devAddress: string;
  /** ERC-20 payment token address. */
  token?: string;
  /** Monad Testnet is the only supported network in the MVP. */
  network?: "monadTestnet";
  agentType?: AgentType;
  tags?: string[];
  /** Bullet points for the "Purpose" section of the agent page. */
  purpose?: string[];
  webcmd?: AnvilWebcmdConfig;
}

export interface ManifestParam {
  name: string;
  type: "string" | "number";
  description: string;
  required: boolean;
  example: string;
}

/** What the CLI uploads and the Store persists. Mirrors the UI `Agent` type. */
export interface AgentManifest {
  id: string;
  name: string;
  description: string;
  tags: string[];
  type: AgentType;
  owner: string;
  price: number;
  /** `price` in token base units, as a string. */
  amount: string;
  endpoint: string;
  params: ManifestParam[];
  envKeys: string[];
  purpose: string[];
  framework: string[];
  staked: number;
  stakers: number;
  calls30d: number;
  avgResponse: string;
  network: string;
  token?: string;
  readme?: string;
  webcmd?: {
    command: string;
    sites: string[];
    avgExecutionMs: number;
    requiresAuth: boolean;
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Identity function — exists purely so editors type-check the config object. */
export declare function defineConfig(config: AnvilConfig): AnvilConfig;

export declare function validateConfig(config: unknown): ValidationResult;

/** Throws a single readable error listing everything wrong. */
export declare function assertValidConfig(config: unknown): asserts config is AnvilConfig;

export declare function toManifest(
  config: AnvilConfig,
  options?: { cwd?: string; decimals?: number },
): AgentManifest;

/** Loads and validates anvil.config.ts (or .js/.mjs) from a directory. */
export declare function loadConfig(cwd?: string): Promise<{
  config: AnvilConfig;
  path: string;
}>;

export declare function toBaseUnits(amount: number, decimals?: number): string;
export declare function slugify(value: string): string;
/** Reads only the KEY names from a dotenv file. Values are never returned. */
export declare function readEnvKeys(file: string): string[];

export declare const CONFIG_FILES: readonly string[];
export declare const DEFAULT_NETWORK: "monadTestnet";
export declare const DEFAULT_DECIMALS: 18;
