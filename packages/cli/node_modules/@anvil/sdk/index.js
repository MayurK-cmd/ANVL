/**
 * @anvil/sdk — owns `anvil.config.ts`.
 *
 * Plain ESM JavaScript with a hand-written `index.d.ts`, on purpose: Node
 * refuses to strip types from files inside node_modules, so a TypeScript
 * source here would force a build step on every consumer. `index.d.ts` is the
 * schema of record — change one, change the other.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIG_FILES = Object.freeze([
  "anvil.config.ts",
  "anvil.config.mts",
  "anvil.config.js",
  "anvil.config.mjs",
]);

export const DEFAULT_NETWORK = "monadTestnet";
export const DEFAULT_DECIMALS = 18;

const AGENT_TYPES = new Set(["api", "browser", "sitemap"]);

export function defineConfig(config) {
  return config;
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Whole units -> base units, without floating point drift.
 * 0.01 * 10**18 in JS is 9999999999999998; string maths is not optional here.
 */
export function toBaseUnits(amount, decimals = DEFAULT_DECIMALS) {
  const text = typeof amount === "string" ? amount.trim() : String(amount);
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`price must be a non-negative decimal number, got "${text}"`);
  }
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) {
    throw new Error(`price has more than ${decimals} decimal places`);
  }
  const padded = fraction.padEnd(decimals, "0");
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0")).toString();
}

function normalizeParamType(type) {
  if (type === String || type === "string" || type === "String") return "string";
  if (type === Number || type === "number" || type === "Number") return "number";
  return null;
}

/** Only KEY names leave this function. Secrets never reach the manifest. */
export function readEnvKeys(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter(Boolean);
}

export function validateConfig(config) {
  const errors = [];
  const warnings = [];
  const push = (message) => errors.push(message);

  if (!config || typeof config !== "object") {
    return { ok: false, errors: ["config must be an object"], warnings };
  }

  const c = /** @type {Record<string, unknown>} */ (config);

  if (!c.name || typeof c.name !== "string") push("name is required (string)");
  if (!c.description || typeof c.description !== "string") {
    push("description is required (string)");
  }
  if (c.id !== undefined && slugify(c.id) !== c.id) {
    push(`id must be a slug — try "${slugify(c.id)}"`);
  }

  if (c.price === undefined) {
    push("price is required (whole $ANVL per call, e.g. 0.01)");
  } else {
    try {
      toBaseUnits(c.price);
    } catch (error) {
      push(error.message);
    }
  }

  if (!c.devAddress || typeof c.devAddress !== "string") {
    push("devAddress is required (the address that receives the creator share)");
  } else if (!/^0x[0-9a-fA-F]{40}$/.test(c.devAddress)) {
    push(`devAddress must be a 0x-prefixed 20-byte address, got "${c.devAddress}"`);
  } else if (/^0x0{40}$/.test(c.devAddress)) {
    // Well-formed but almost certainly the untouched scaffold placeholder —
    // shipping it sends every creator payment to the burn address.
    push("devAddress is the zero address — set it to the address that should be paid");
  }

  if (c.token !== undefined && !/^0x[0-9a-fA-F]{40}$/.test(String(c.token))) {
    push(`token must be a 0x-prefixed 20-byte address, got "${c.token}"`);
  }

  if (c.port !== undefined) {
    const port = Number(c.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      push("port must be an integer between 1 and 65535");
    }
  }

  if (c.endpoint !== undefined) {
    try {
      new URL(String(c.endpoint));
    } catch {
      push(`endpoint must be an absolute URL, got "${c.endpoint}"`);
    }
  } else if (c.port === undefined) {
    push("set endpoint (or port, to derive a localhost endpoint)");
  }

  if (c.network !== undefined && c.network !== DEFAULT_NETWORK) {
    push(`network must be "${DEFAULT_NETWORK}" — Monad Testnet is the only supported network`);
  }

  const agentType = c.agentType ?? "api";
  if (!AGENT_TYPES.has(agentType)) {
    push(`agentType must be one of ${[...AGENT_TYPES].join(", ")}`);
  }

  if (!c.params || typeof c.params !== "object" || Array.isArray(c.params)) {
    push("params is required (an object of parameter definitions)");
  } else {
    for (const [name, param] of Object.entries(c.params)) {
      if (!param || typeof param !== "object") {
        push(`params.${name} must be an object`);
        continue;
      }
      if (!normalizeParamType(param.type)) {
        push(`params.${name}.type must be String or Number`);
      }
      if (!param.description) {
        push(`params.${name}.description is required`);
      }
    }
  }

  if (agentType === "browser" && !c.webcmd?.command) {
    push('webcmd.command is required when agentType is "browser"');
  }
  if (c.webcmd && agentType !== "browser") {
    warnings.push('webcmd is set but agentType is not "browser" — it will be ignored');
  }
  if (c.readmePath && !c.description) {
    warnings.push("readmePath is set but description is empty");
  }
  if (!c.tags?.length) {
    warnings.push("no tags — the agent will be harder to find in the Store");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertValidConfig(config) {
  const { ok, errors } = validateConfig(config);
  if (!ok) {
    throw new Error(`Invalid anvil.config:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}

function resolveFrom(cwd, maybePath) {
  return isAbsolute(maybePath) ? maybePath : resolve(cwd, maybePath);
}

export function toManifest(config, options = {}) {
  assertValidConfig(config);
  const cwd = options.cwd ?? process.cwd();
  const decimals = options.decimals ?? DEFAULT_DECIMALS;

  const id = config.id ?? slugify(config.name);
  const type = config.agentType ?? "api";
  const network = config.network ?? DEFAULT_NETWORK;
  const endpoint = config.endpoint ?? `http://localhost:${config.port}/send`;

  const params = Object.entries(config.params).map(([name, param]) => ({
    name,
    type: normalizeParamType(param.type),
    description: param.description,
    required: param.required ?? false,
    example: param.example ?? param.description,
  }));

  const envKeys = config.env ? readEnvKeys(resolveFrom(cwd, config.env)) : [];

  let readme;
  if (config.readmePath) {
    const file = resolveFrom(cwd, config.readmePath);
    if (existsSync(file)) readme = readFileSync(file, "utf8");
  }

  const framework = [
    "Runtime: Node",
    `Payment: M402 (${network})`,
    type === "browser" ? "Execution: Webcmd replay" : "Execution: HTTP handler",
  ];

  return {
    id,
    name: config.name,
    description: config.description,
    tags: config.tags ?? [],
    type,
    owner: config.devAddress,
    price: Number(config.price),
    amount: toBaseUnits(config.price, decimals),
    endpoint,
    params,
    envKeys,
    purpose: config.purpose ?? [],
    framework,
    // Real numbers arrive from the indexer once the agent has traffic.
    staked: 0,
    stakers: 0,
    calls30d: 0,
    avgResponse: "—",
    network,
    ...(config.token ? { token: config.token } : {}),
    ...(readme ? { readme } : {}),
    ...(type === "browser" && config.webcmd
      ? {
          webcmd: {
            command: config.webcmd.command,
            sites: config.webcmd.sites ?? [],
            avgExecutionMs: config.webcmd.avgExecutionMs ?? 0,
            requiresAuth: config.webcmd.requiresAuth ?? false,
          },
        }
      : {}),
  };
}

export async function loadConfig(cwd = process.cwd()) {
  const found = CONFIG_FILES.map((file) => join(cwd, file)).find((file) =>
    existsSync(file),
  );
  if (!found) {
    throw new Error(
      `No anvil config found in ${cwd}. Expected one of: ${CONFIG_FILES.join(", ")}. Run \`anvil init <name>\` to scaffold one.`,
    );
  }

  let loaded;
  try {
    loaded = await import(`${pathToFileURL(found).href}?t=${Date.now()}`);
  } catch (error) {
    if (error?.code === "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING") throw error;
    if (basename(found).endsWith(".ts") && /Unknown file extension|strip/i.test(String(error?.message))) {
      throw new Error(
        `Could not load ${found}. Reading anvil.config.ts needs Node 22.18+ (type stripping). You are on ${process.version} — upgrade Node, or rename the file to anvil.config.mjs.`,
      );
    }
    throw error;
  }

  const config = loaded.default ?? loaded.config ?? loaded.anvilConfig;
  if (!config) {
    throw new Error(`${found} has no default export. Use \`export default defineConfig({ … })\`.`);
  }
  return { config, path: found };
}
