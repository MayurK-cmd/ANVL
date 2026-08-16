/**
 * M402 facilitator — SERVER ONLY. Never import this from a client component:
 * it reads the facilitator private key.
 *
 * Two modes, decided by env:
 *
 *  - dev (default)      — no token deployed. Challenges are still real EIP-712
 *                         and signatures are still really verified; settlement
 *                         is skipped and reported as `settled: false`.
 *  - testnet (settling) — M402_TOKEN_ADDRESS + M402_PAY_TO + M402_FACILITATOR_KEY
 *                         set. Reads the payer's permit nonce, submits
 *                         permit() + transferFrom() on Monad Testnet.
 *
 * The mode is reported in the response so nothing silently pretends to settle.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  keccak256,
  parseAbi,
  stringToBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import {
  DEFAULT_DEADLINE_WINDOW,
  type PaymentPayload,
  type PaymentRequirements,
} from "./m402";

const PERMIT_ABI = parseAbi([
  "function nonces(address owner) view returns (uint256)",
]);

/** StakingRevShare.settle — permit + pull + 50/30/20 split in one call. */
const STAKING_REV_SHARE_ABI = parseAbi([
  "function settle(bytes32 agentId, address payer, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
]);

/** Matches how agents are registered on AgentRegistry: keccak256(bytes(id)). */
function toOnChainAgentId(agentId: string): Hex {
  return keccak256(stringToBytes(agentId));
}

/** Stand-ins used in dev mode so the EIP-712 domain is still well-formed. */
const DEV_TOKEN: Address = "0x0000000000000000000000000000000000000a02";
const DEV_PAY_TO: Address = "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c";

export type FacilitatorConfig = {
  chainId: number;
  rpcUrl: string;
  token: Address;
  payTo: Address;
  tokenName: string;
  tokenVersion: string;
  explorer: string;
  settlementEnabled: boolean;
  facilitatorKey?: Hex;
};

export function getConfig(): FacilitatorConfig {
  const token = process.env.M402_TOKEN_ADDRESS;
  const payTo = process.env.M402_PAY_TO;
  const key = process.env.M402_FACILITATOR_KEY;
  const settlementEnabled = Boolean(token && payTo && key);

  return {
    chainId: Number(process.env.M402_CHAIN_ID ?? monadTestnet.id),
    rpcUrl: process.env.M402_RPC_URL ?? "https://testnet-rpc.monad.xyz",
    token: token ? getAddress(token) : DEV_TOKEN,
    payTo: payTo ? getAddress(payTo) : DEV_PAY_TO,
    tokenName: process.env.M402_TOKEN_NAME ?? "Anvil",
    tokenVersion: process.env.M402_TOKEN_VERSION ?? "1",
    explorer: process.env.M402_EXPLORER ?? "https://testnet.monadscan.com",
    settlementEnabled,
    facilitatorKey: settlementEnabled ? (key as Hex) : undefined,
  };
}

function publicClient(config: FacilitatorConfig) {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(config.rpcUrl),
  });
}

function facilitatorAccount(config: FacilitatorConfig) {
  if (!config.facilitatorKey) throw new Error("facilitator key not configured");
  return privateKeyToAccount(config.facilitatorKey);
}

/**
 * The permit's `spender` — whoever calls transferFrom. Once settlement is on,
 * that's StakingRevShare itself (it pulls funds into its own balance to
 * split them), not the facilitator's EOA. In dev, a stable stub.
 */
export function spenderAddress(config: FacilitatorConfig): Address {
  return config.settlementEnabled ? config.payTo : "0x000000000000000000000000000000000000f402";
}

/**
 * Build the 402 challenge for one call.
 *
 * The permit nonce must be the token's current nonce for this payer or the
 * on-chain `permit()` reverts, so it is read from chain whenever settlement is
 * configured.
 */
export async function generatePaymentRequirements(args: {
  payer: Address;
  amount: string;
  agentId: string;
  description: string;
  now?: number;
}): Promise<PaymentRequirements> {
  const config = getConfig();
  const now = args.now ?? Math.floor(Date.now() / 1000);

  let nonce = 0n;
  if (config.settlementEnabled) {
    nonce = await publicClient(config).readContract({
      address: config.token,
      abi: PERMIT_ABI,
      functionName: "nonces",
      args: [args.payer],
    });
  }

  return {
    scheme: "permit",
    chainId: config.chainId,
    payTo: config.payTo,
    spender: spenderAddress(config),
    token: config.token,
    tokenName: config.tokenName,
    tokenVersion: config.tokenVersion,
    amount: args.amount,
    agentId: args.agentId,
    payer: getAddress(args.payer),
    nonce: nonce.toString(),
    deadline: now + DEFAULT_DEADLINE_WINDOW,
    description: args.description,
  };
}

export type Settlement = {
  settled: boolean;
  txHash: string;
  explorerUrl?: string;
  note?: string;
};

/**
 * One call: StakingRevShare.settle() runs permit() + transferFrom() + the
 * 50/30/20 split atomically. `payTo` must be StakingRevShare's address and
 * the agent must already be registered on AgentRegistry (settle() reverts
 * with AgentNotActive otherwise).
 */
export async function settle(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<Settlement> {
  const config = getConfig();

  if (!config.settlementEnabled) {
    return {
      settled: false,
      txHash: `dev-${Date.now().toString(16)}`,
      note: "signature verified; on-chain settlement disabled (set M402_TOKEN_ADDRESS, M402_PAY_TO, M402_FACILITATOR_KEY)",
    };
  }

  const account = facilitatorAccount(config);
  const pub = publicClient(config);
  const wallet = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(config.rpcUrl),
  });

  const value = BigInt(requirements.amount);
  const { r, s, v } = splitSignature(payload.signature);

  const settleArgs = [
    toOnChainAgentId(requirements.agentId),
    requirements.payer,
    value,
    BigInt(payload.deadline),
    v,
    r,
    s,
  ] as const;

  // Monad charges on the gas LIMIT, not gas used, so a fat limit is money the
  // user loses. Estimate and add the smallest useful buffer.
  const gas = await pub.estimateContractGas({
    account,
    address: config.payTo,
    abi: STAKING_REV_SHARE_ABI,
    functionName: "settle",
    args: settleArgs,
  });

  const hash = await wallet.writeContract({
    address: config.payTo,
    abi: STAKING_REV_SHARE_ABI,
    functionName: "settle",
    args: settleArgs,
    gas: gas + gas / 10n,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });

  return {
    settled: receipt.status === "success",
    txHash: hash,
    explorerUrl: `${config.explorer}/tx/${hash}`,
  };
}

function splitSignature(signature: Hex): { r: Hex; s: Hex; v: number } {
  const raw = signature.slice(2);
  if (raw.length !== 130) throw new Error("signature must be 65 bytes");
  const r = `0x${raw.slice(0, 64)}` as Hex;
  const s = `0x${raw.slice(64, 128)}` as Hex;
  let v = parseInt(raw.slice(128, 130), 16);
  if (v < 27) v += 27; // some signers emit 0/1
  return { r, s, v };
}
