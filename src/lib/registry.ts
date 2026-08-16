/**
 * Agent registry — SERVER ONLY (touches the filesystem).
 *
 * The catalog is the built-in fixtures plus whatever `anvil deploy` has
 * uploaded, with uploads winning on id collision.
 *
 * ponytail: a JSON file under .anvil/ is the whole store. It is single-node and
 * not concurrent-safe, which is the right size for a local marketplace demo —
 * AgentRegistry on Monad replaces it, and `toAgent()` is the seam where a
 * contract read would slot in.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  parseAbi,
  stringToBytes,
  type Address,
} from "viem";
import { monadTestnet } from "viem/chains";
import { agents as fixtures, type Agent, type AgentType } from "@/data/agents";
import { formatToken } from "@/lib/format";

const DIR = join(process.cwd(), ".anvil");
const FILE = join(DIR, "agents.json");

const REGISTRY_ABI = parseAbi([
  "function getAgent(bytes32 agentId) view returns (address owner, uint96 price, bool active)",
]);

const STAKING_ABI = parseAbi([
  "function pools(bytes32 agentId) view returns (uint256 totalStaked, uint256 accRewardPerShare)",
]);

const IDENTITY_ABI = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"]);

/**
 * AgentRegistry has no field linking an agent to an ERC-8004 identity token —
 * they're two separate contracts with no on-chain relationship to each other.
 * This records which token id was minted for which agent id via
 * `IdentityRegistry.register(agentURI)` at setup time. Tied to the current
 * IdentityRegistry deployment — re-register and update this map after a
 * contract redeploy, or the ownerOf() check below will just fail closed.
 */
const IDENTITY_TOKEN_IDS: Record<string, number> = {
  "echo-v1": 1,
  "scholar-search-v1": 2,
  "price-monitor-v1": 3,
  "scholar-compare-v1": 4,
};

const readClient = createPublicClient({
  chain: monadTestnet,
  // Coalesces the concurrent per-agent readContract() calls in withOnChainData
  // (registry + staking + identity, times however many agents) into one
  // Multicall3 request instead of bursting past the public RPC's 15/sec cap.
  batch: { multicall: true },
  transport: http(process.env.M402_RPC_URL ?? "https://testnet-rpc.monad.xyz"),
});

function registryAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_AGENT_REGISTRY;
  return addr ? getAddress(addr) : null;
}

function stakingAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_STAKING_REV_SHARE;
  return addr ? getAddress(addr) : null;
}

function identityAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY;
  return addr ? getAddress(addr) : null;
}

/**
 * Overlay live AgentRegistry/StakingRevShare data onto an Agent — owner, the
 * actual amount a call charges, and the real staked total all become on-chain
 * truth instead of static fixture numbers nobody verifies. Returns null if
 * the registry says the agent is deactivated (it should disappear from the
 * Store).
 *
 * Falls back to the agent unchanged if a contract isn't configured, the chain
 * read fails, or the id was never registered on-chain (all current uploads,
 * and any fixture before its one-time `register()` call) — this is a seam,
 * not a hard dependency.
 */
export async function withOnChainData(agent: Agent): Promise<Agent | null> {
  const registry = registryAddress();
  if (!registry) return agent;

  let owner = agent.owner as Address;
  let amount = agent.amount;
  try {
    const [chainOwner, price, active] = await readClient.readContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: "getAgent",
      args: [keccak256(stringToBytes(agent.id))],
    });
    if (!active) return null;
    owner = chainOwner;
    amount = price.toString();
  } catch {
    return agent;
  }

  let staked = agent.staked;
  const staking = stakingAddress();
  if (staking) {
    try {
      const [totalStaked] = await readClient.readContract({
        address: staking,
        abi: STAKING_ABI,
        functionName: "pools",
        args: [keccak256(stringToBytes(agent.id))],
      });
      staked = formatToken(totalStaked);
    } catch {
      // Staking read is best-effort — the price/owner overlay above already
      // succeeded, so keep going with the fixture's staked value.
    }
  }

  let identityTokenId: number | null = null;
  const identity = identityAddress();
  const mappedTokenId = IDENTITY_TOKEN_IDS[agent.id];
  if (identity && mappedTokenId) {
    try {
      const identityOwner = await readClient.readContract({
        address: identity,
        abi: IDENTITY_ABI,
        functionName: "ownerOf",
        args: [BigInt(mappedTokenId)],
      });
      // Only show the badge if the identity NFT is still held by the same
      // address AgentRegistry currently lists as owner — a stale mapping
      // (e.g. after a redeploy, or if ownership ever transfers) fails closed.
      if (getAddress(identityOwner) === getAddress(owner)) {
        identityTokenId = mappedTokenId;
      }
    } catch {
      // Token doesn't exist on this deployment — leave unverified.
    }
  }

  return { ...agent, owner, amount, staked, identityTokenId };
}

export type UploadedAgent = Agent & {
  endpoint: string;
  readme?: string;
  uploadedAt: string;
};

function readAll(): UploadedAgent[] {
  if (!existsSync(FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as UploadedAgent[]) : [];
  } catch {
    // A corrupt store should not take the marketplace down.
    return [];
  }
}

function writeAll(list: UploadedAgent[]): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, `${JSON.stringify(list, null, 2)}\n`, "utf8");
}

export function uploadedAgents(): UploadedAgent[] {
  return readAll();
}

export async function catalog(): Promise<Agent[]> {
  const uploaded = readAll();
  const overridden = new Set(uploaded.map((agent) => agent.id));
  const merged = [...uploaded, ...fixtures.filter((agent) => !overridden.has(agent.id))];
  const withChainData = await Promise.all(merged.map(withOnChainData));
  return withChainData.filter((agent): agent is Agent => agent !== null);
}

export async function getCatalogAgent(id: string): Promise<Agent | undefined> {
  const agents = await catalog();
  return agents.find((agent) => agent.id === id);
}

/** Manifest shape as it arrives over HTTP — assume nothing. */
export type ManifestInput = Record<string, unknown>;

const AGENT_TYPES: AgentType[] = ["api", "browser", "sitemap"];

/**
 * Validate at the trust boundary. @anvil/sdk validates the developer's config
 * for good error messages; this re-checks the wire payload because a manifest
 * arriving over HTTP is untrusted input, not a config file.
 */
export function validateManifest(input: ManifestInput): string[] {
  const errors: string[] = [];
  const str = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(str("id"))) {
    errors.push("id must be a lowercase slug");
  }
  if (!str("name")) errors.push("name is required");
  if (!str("description")) errors.push("description is required");
  if (!/^0x[0-9a-fA-F]{40}$/.test(str("owner"))) {
    errors.push("owner must be a 0x-prefixed address");
  }
  if (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price < 0) {
    errors.push("price must be a non-negative number");
  }
  if (!/^\d+$/.test(str("amount"))) errors.push("amount must be a base-unit string");
  if (!AGENT_TYPES.includes(input.type as AgentType)) {
    errors.push(`type must be one of ${AGENT_TYPES.join(", ")}`);
  }

  const endpoint = str("endpoint");
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      errors.push("endpoint must be http(s)");
    }
  } catch {
    errors.push("endpoint must be an absolute URL");
  }

  if (!Array.isArray(input.params)) errors.push("params must be an array");
  if (input.envKeys !== undefined && !Array.isArray(input.envKeys)) {
    errors.push("envKeys must be an array of names");
  }
  return errors;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Manifest -> the Agent shape the UI renders. Unknown fields are dropped. */
export function toAgent(input: ManifestInput): UploadedAgent {
  const params = (Array.isArray(input.params) ? input.params : []).map((raw) => {
    const param = raw as Record<string, unknown>;
    return {
      name: String(param.name ?? ""),
      type: param.type === "number" ? ("number" as const) : ("string" as const),
      description: String(param.description ?? ""),
      required: Boolean(param.required),
      example: String(param.example ?? ""),
    };
  });

  const webcmd = input.webcmd as Record<string, unknown> | undefined;

  return {
    id: String(input.id),
    name: String(input.name),
    description: String(input.description),
    tags: asStrings(input.tags),
    type: input.type as AgentType,
    owner: String(input.owner),
    price: Number(input.price),
    amount: String(input.amount),
    // Not self-reported: an uploader claiming a stake or call count nobody
    // verifies is worse than no number at all. `withOnChainData` overlays the
    // real total once/if this id is registered on AgentRegistry.
    staked: "0.0000",
    avgResponse: String(input.avgResponse ?? "—"),
    purpose: asStrings(input.purpose),
    framework: asStrings(input.framework),
    params,
    envKeys: asStrings(input.envKeys),
    endpoint: String(input.endpoint),
    readme: typeof input.readme === "string" ? input.readme : undefined,
    uploadedAt: new Date().toISOString(),
    ...(input.type === "browser" && webcmd
      ? {
          webcmd: {
            command: String(webcmd.command ?? ""),
            sites: asStrings(webcmd.sites),
            avgExecutionMs: Number(webcmd.avgExecutionMs ?? 0),
            requiresAuth: Boolean(webcmd.requiresAuth),
          },
        }
      : {}),
  };
}

export function saveAgent(agent: UploadedAgent): { updated: boolean } {
  const list = readAll();
  const index = list.findIndex((existing) => existing.id === agent.id);
  if (index >= 0) {
    list[index] = agent;
    writeAll(list);
    return { updated: true };
  }
  writeAll([agent, ...list]);
  return { updated: false };
}
