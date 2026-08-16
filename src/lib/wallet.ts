/**
 * MetaMask (and any EIP-1193 injected wallet) on Monad Testnet.
 *
 * The M402 payer only ever signs a typed message — no transaction, no gas, no
 * MON balance required to pay for an agent call. So this file is small on
 * purpose: connect, make sure we're on the right chain, sign.
 *
 * Para replaces this later; `signerFor()` returns exactly the shape
 * `callPaidAPI` wants, so swapping the provider changes nothing downstream.
 */

"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  erc20Abi,
  getAddress,
  keccak256,
  parseAbi,
  stringToBytes,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { monadTestnet } from "viem/chains";
import type { SignTypedData } from "./m402";
import { EXPLORER, FAUCET, formatToken, shortAddr } from "./format";

export { EXPLORER, FAUCET, formatToken, shortAddr };

export const CHAIN = monadTestnet;
export const CHAIN_ID_HEX = `0x${monadTestnet.id.toString(16)}` as const;

/** Optional: set to show a live $ANVL balance once the token is deployed. */
const ANVL_TOKEN = process.env.NEXT_PUBLIC_ANVL_TOKEN as Address | undefined;

declare global {
  interface Window {
    ethereum?: EIP1193Provider & {
      isMetaMask?: boolean;
      providers?: (EIP1193Provider & { isMetaMask?: boolean })[];
    };
  }
}

/** Prefer MetaMask when several wallets fight over `window.ethereum`. */
export function getProvider(): EIP1193Provider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const injected = window.ethereum;
  if (injected.providers?.length) {
    return injected.providers.find((p) => p.isMetaMask) ?? injected.providers[0];
  }
  return injected;
}

export function hasWallet(): boolean {
  return getProvider() !== null;
}

function requireProvider(): EIP1193Provider {
  const provider = getProvider();
  if (!provider) {
    throw new Error("No wallet found. Install MetaMask to pay for agent calls.");
  }
  return provider;
}

export async function currentAccounts(): Promise<Address[]> {
  const provider = getProvider();
  if (!provider) return [];
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as Address[];
  return accounts.map(getAddress);
}

export async function connect(): Promise<Address> {
  const provider = requireProvider();
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as Address[];
  if (!accounts?.length) throw new Error("Wallet returned no accounts");
  return getAddress(accounts[0]);
}

export async function currentChainId(): Promise<number | null> {
  const provider = getProvider();
  if (!provider) return null;
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(hex, 16);
}

/**
 * Switch to Monad Testnet, adding it first if MetaMask has never seen it.
 * 4902 = "unrecognized chain", which is the normal path for a fresh wallet.
 */
export async function switchToMonad(): Promise<void> {
  const provider = requireProvider();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code !== 4902 && code !== -32603) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_ID_HEX,
          chainName: CHAIN.name,
          nativeCurrency: CHAIN.nativeCurrency,
          rpcUrls: [...CHAIN.rpcUrls.default.http],
          blockExplorerUrls: [EXPLORER],
        },
      ],
    });
  }
}

/** The `{ payer, signTypedData }` pair `callPaidAPI` expects. */
export function signerFor(account: Address): {
  payer: Address;
  signTypedData: SignTypedData;
} {
  const wallet = createWalletClient({
    account,
    chain: CHAIN,
    transport: custom(requireProvider()),
  });
  return {
    payer: account,
    signTypedData: (args) =>
      wallet.signTypedData({
        account,
        domain: { ...args.domain },
        types: args.types,
        primaryType: args.primaryType,
        message: { ...args.message },
      }),
  };
}

const readClient = createPublicClient({
  chain: CHAIN,
  // Coalesces concurrent readContract() calls (e.g. StakePanel's per-agent
  // pools/positions/pendingReward reads) into one Multicall3 request instead
  // of firing each as its own eth_call — the public RPC rate-limits at 15/sec.
  batch: { multicall: true },
  transport: http(CHAIN.rpcUrls.default.http[0]),
});

const IDENTITY_REGISTRY = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY as Address | undefined;

/**
 * Registering an ERC-8004 identity is a normal write transaction, not a
 * gasless M402 signature — the caller needs real testnet MON. Unlike
 * `signerFor()`, this actually sends a transaction and costs gas.
 */
export async function registerIdentity(account: Address, agentURI: string): Promise<Hex> {
  if (!IDENTITY_REGISTRY) throw new Error("IdentityRegistry is not configured");
  const wallet = createWalletClient({
    account,
    chain: CHAIN,
    transport: custom(requireProvider()),
  });
  return wallet.writeContract({
    address: IDENTITY_REGISTRY,
    abi: parseAbi(["function register(string agentURI) returns (uint256)"]),
    functionName: "register",
    args: [agentURI],
    account,
    chain: CHAIN,
  });
}

export async function waitForTx(hash: Hex) {
  return readClient.waitForTransactionReceipt({ hash });
}

const STAKING_REV_SHARE = process.env.NEXT_PUBLIC_STAKING_REV_SHARE as Address | undefined;

const STAKING_ABI = parseAbi([
  "function pools(bytes32 agentId) view returns (uint256 totalStaked, uint256 accRewardPerShare)",
  "function positions(bytes32 agentId, address staker) view returns (uint256 amount, uint256 rewardDebt)",
  "function pendingReward(bytes32 agentId, address staker) view returns (uint256)",
  "function stakeWithPermit(bytes32 agentId, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  "function unstake(bytes32 agentId, uint256 amount)",
  "function claim(bytes32 agentId)",
]);

const NONCES_ABI = parseAbi(["function nonces(address owner) view returns (uint256)"]);

/** Same convention used everywhere agentIds meet a contract: keccak256(bytes(id)). */
export function agentIdHash(agentId: string): Hex {
  return keccak256(stringToBytes(agentId));
}

export type StakeInfo = { totalStaked: bigint; yourStake: bigint; pendingReward: bigint };

export async function readStakeInfo(agentId: string, account: Address): Promise<StakeInfo> {
  if (!STAKING_REV_SHARE) return { totalStaked: 0n, yourStake: 0n, pendingReward: 0n };
  const hash = agentIdHash(agentId);
  const [pool, position, pendingReward] = await Promise.all([
    readClient.readContract({ address: STAKING_REV_SHARE, abi: STAKING_ABI, functionName: "pools", args: [hash] }),
    readClient.readContract({
      address: STAKING_REV_SHARE,
      abi: STAKING_ABI,
      functionName: "positions",
      args: [hash, account],
    }),
    readClient.readContract({
      address: STAKING_REV_SHARE,
      abi: STAKING_ABI,
      functionName: "pendingReward",
      args: [hash, account],
    }),
  ]);
  return { totalStaked: pool[0], yourStake: position[0], pendingReward };
}

/**
 * Staking is a real write, not a gasless M402 signature — the connected
 * wallet submits the transaction and pays its own gas. `stakeWithPermit`
 * still saves a separate `approve()` transaction: one signature (free) plus
 * one transaction (real gas) instead of two transactions.
 */
export async function stakeAnvl(account: Address, agentId: string, amount: bigint): Promise<Hex> {
  if (!STAKING_REV_SHARE) throw new Error("StakingRevShare is not configured");
  if (!ANVL_TOKEN) throw new Error("AnvilToken is not configured");
  const wallet = createWalletClient({ account, chain: CHAIN, transport: custom(requireProvider()) });

  const nonce = await readClient.readContract({
    address: ANVL_TOKEN,
    abi: NONCES_ABI,
    functionName: "nonces",
    args: [account],
  });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const signature = await wallet.signTypedData({
    account,
    domain: { name: "Anvil", version: "1", chainId: CHAIN.id, verifyingContract: ANVL_TOKEN },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner: account, spender: STAKING_REV_SHARE, value: amount, nonce, deadline },
  });

  const r = `0x${signature.slice(2, 66)}` as Hex;
  const s = `0x${signature.slice(66, 130)}` as Hex;
  let v = Number.parseInt(signature.slice(130, 132), 16);
  if (v < 27) v += 27;

  return wallet.writeContract({
    address: STAKING_REV_SHARE,
    abi: STAKING_ABI,
    functionName: "stakeWithPermit",
    args: [agentIdHash(agentId), amount, deadline, v, r, s],
    account,
    chain: CHAIN,
  });
}

export async function unstakeAnvl(account: Address, agentId: string, amount: bigint): Promise<Hex> {
  if (!STAKING_REV_SHARE) throw new Error("StakingRevShare is not configured");
  const wallet = createWalletClient({ account, chain: CHAIN, transport: custom(requireProvider()) });
  return wallet.writeContract({
    address: STAKING_REV_SHARE,
    abi: STAKING_ABI,
    functionName: "unstake",
    args: [agentIdHash(agentId), amount],
    account,
    chain: CHAIN,
  });
}

export async function claimReward(account: Address, agentId: string): Promise<Hex> {
  if (!STAKING_REV_SHARE) throw new Error("StakingRevShare is not configured");
  const wallet = createWalletClient({ account, chain: CHAIN, transport: custom(requireProvider()) });
  return wallet.writeContract({
    address: STAKING_REV_SHARE,
    abi: STAKING_ABI,
    functionName: "claim",
    args: [agentIdHash(agentId)],
    account,
    chain: CHAIN,
  });
}

/**
 * `null` means "couldn't read this round" (transient RPC hiccup, or
 * NEXT_PUBLIC_ANVL_TOKEN unset for `anvl`) — distinct from a real zero
 * balance. Callers should keep the last known value on `null`, not blank it.
 */
export type Balances = { mon: bigint | null; anvl: bigint | null };

/**
 * Fetches MON and $ANVL independently — a transient failure on one must not
 * take down the other, and this function must never throw, or a caller that
 * silently swallows the error (to "keep the last known balance") ends up
 * keeping it forever, since nothing else ever retries.
 */
export async function readBalances(account: Address): Promise<Balances> {
  const [monResult, anvlResult] = await Promise.allSettled([
    readClient.getBalance({ address: account }),
    ANVL_TOKEN
      ? readClient.readContract({
          address: ANVL_TOKEN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account],
        })
      : Promise.resolve(null),
  ]);
  return {
    mon: monResult.status === "fulfilled" ? monResult.value : null,
    anvl: anvlResult.status === "fulfilled" ? anvlResult.value : null,
  };
}

