/**
 * ERC-8004 identity reads — SERVER ONLY. `IdentityRegistry` has no
 * `totalSupply`/enumeration, but `register()` always does
 * `agentId = ++_lastId` with no burn function, so ids are dense from 1 with
 * no gaps — scanning sequentially until the first revert is a complete
 * listing, not a heuristic. Capped at `maxScan` as a sane demo-scale bound.
 */

import { createPublicClient, getAddress, http, parseAbi, type Address } from "viem";
import { monadTestnet } from "viem/chains";
import { agents as fixtures } from "@/data/agents";

const IDENTITY_ABI = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);

const readClient = createPublicClient({
  chain: monadTestnet,
  transport: http(process.env.M402_RPC_URL ?? "https://testnet-rpc.monad.xyz"),
});

function identityAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY;
  return addr ? getAddress(addr) : null;
}

export type IdentityRecord = {
  tokenId: number;
  owner: Address;
  tokenURI: string | null;
  agentName: string | null;
};

const KNOWN_AGENT_NAMES: Record<string, string> = Object.fromEntries(
  fixtures.map((a) => [a.id, a.name]),
);

/** Matches a registered agentURI like ".../api/agents/<id>/send" back to a catalog agent's display name. */
function matchAgentName(uri: string | null): string | null {
  if (!uri) return null;
  for (const [id, name] of Object.entries(KNOWN_AGENT_NAMES)) {
    if (uri.includes(`/agents/${id}/`)) return name;
  }
  return null;
}

export async function listIdentities(maxScan = 50): Promise<IdentityRecord[]> {
  const registry = identityAddress();
  if (!registry) return [];

  const records: IdentityRecord[] = [];
  for (let id = 1; id <= maxScan; id++) {
    let owner: Address;
    try {
      owner = await readClient.readContract({
        address: registry,
        abi: IDENTITY_ABI,
        functionName: "ownerOf",
        args: [BigInt(id)],
      });
    } catch {
      break; // first gap ends the dense sequential range
    }

    let uri: string | null = null;
    try {
      uri = await readClient.readContract({
        address: registry,
        abi: IDENTITY_ABI,
        functionName: "tokenURI",
        args: [BigInt(id)],
      });
    } catch {
      // No URI set for this token — leave null.
    }

    records.push({ tokenId: id, owner, tokenURI: uri || null, agentName: matchAgentName(uri) });
  }
  return records;
}
