/**
 * M402 — HTTP 402 micropayments on Monad Testnet.
 *
 * The payer signs an EIP-2612 `Permit` off-chain (no gas, no transaction) and
 * the facilitator settles it on-chain with `permit()` + `transferFrom()`.
 *
 * This module is isomorphic — it runs in the browser and on the server, and it
 * holds no secrets and no RPC access. Chain reads/writes live in
 * `facilitator.ts`, which is server-only.
 */

import {
  recoverTypedDataAddress,
  isAddress,
  getAddress,
  type Address,
  type Hex,
} from "viem";

/** EIP-2612. The token's own domain separator makes this token-specific. */
export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** Widest signature validity we will accept on a retry, in seconds. */
export const MAX_DEADLINE_WINDOW = 300;
/** Default validity handed out with a 402. Generous at 400ms blocks. */
export const DEFAULT_DEADLINE_WINDOW = 120;

export type PaymentRequirements = {
  scheme: "permit";
  chainId: number;
  /** Where the tokens end up — the creator, or StakingRevShare once deployed. */
  payTo: Address;
  /** Who the permit authorizes to move the tokens: the facilitator. */
  spender: Address;
  token: Address;
  /** EIP-712 domain of the token contract. */
  tokenName: string;
  tokenVersion: string;
  amount: string;
  agentId: string;
  payer: Address;
  nonce: string;
  deadline: number;
  description: string;
};

/**
 * What the client sends back in `X-PAYMENT`.
 *
 * Deliberately does NOT echo amount/token/spender: the server re-derives those
 * from its own state and verifies the signature against them, so a tampered
 * payload can only ever produce a signature mismatch. `nonce` and `deadline`
 * come back because the signature commits to them and the server issues them
 * before it knows they'll be used.
 */
export type PaymentPayload = {
  payer: Address;
  nonce: string;
  deadline: number;
  signature: Hex;
};

export type VerifyResult =
  | { valid: true; payer: Address }
  | { valid: false; error: string };

export function permitDomain(requirements: PaymentRequirements) {
  return {
    name: requirements.tokenName,
    version: requirements.tokenVersion,
    chainId: requirements.chainId,
    verifyingContract: requirements.token,
  } as const;
}

export function permitMessage(requirements: PaymentRequirements) {
  return {
    owner: requirements.payer,
    spender: requirements.spender,
    value: BigInt(requirements.amount),
    nonce: BigInt(requirements.nonce),
    deadline: BigInt(requirements.deadline),
  } as const;
}

function toB64(value: string): string {
  return typeof Buffer !== "undefined"
    ? Buffer.from(value, "utf8").toString("base64")
    : btoa(value);
}

function fromB64(value: string): string {
  return typeof Buffer !== "undefined"
    ? Buffer.from(value, "base64").toString("utf8")
    : atob(value);
}

export function encodeRequirements(requirements: PaymentRequirements): string {
  return toB64(JSON.stringify(requirements));
}

export function decodeRequirements(header: string): PaymentRequirements {
  return JSON.parse(fromB64(header)) as PaymentRequirements;
}

export function encodePayment(payload: PaymentPayload): string {
  return toB64(JSON.stringify(payload));
}

export function decodePayment(header: string): PaymentPayload {
  return JSON.parse(fromB64(header)) as PaymentPayload;
}

/**
 * Verify a signed payment against the requirements the server issued.
 *
 * Pure crypto + range checks. Submits nothing, reads no chain state — call this
 * BEFORE running the agent, and only settle once the agent has succeeded.
 */
export async function verifyPayment(
  paymentHeader: string,
  requirements: PaymentRequirements,
  now: number = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  if (!paymentHeader) return { valid: false, error: "missing X-PAYMENT" };

  let payload: PaymentPayload;
  try {
    payload = decodePayment(paymentHeader);
  } catch {
    return { valid: false, error: "malformed X-PAYMENT" };
  }

  if (!payload.signature || !payload.payer) {
    return { valid: false, error: "payment missing payer or signature" };
  }
  if (!isAddress(payload.payer)) {
    return { valid: false, error: "payer is not an address" };
  }
  if (getAddress(payload.payer) !== getAddress(requirements.payer)) {
    return { valid: false, error: "payer does not match the issued challenge" };
  }

  const deadline = Number(payload.deadline);
  if (!Number.isFinite(deadline)) {
    return { valid: false, error: "deadline is not a number" };
  }
  if (deadline <= now) {
    return { valid: false, error: "payment signature expired" };
  }
  if (deadline > now + MAX_DEADLINE_WINDOW) {
    return { valid: false, error: "deadline too far in the future" };
  }

  // Amount, token, spender and chainId come from `requirements` (server truth),
  // never from the payload — that is what makes tampering unforgeable.
  const signed: PaymentRequirements = {
    ...requirements,
    nonce: String(payload.nonce),
    deadline,
  };

  let recovered: Address;
  try {
    recovered = await recoverTypedDataAddress({
      domain: permitDomain(signed),
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: permitMessage(signed),
      signature: payload.signature,
    });
  } catch {
    return { valid: false, error: "signature could not be recovered" };
  }

  if (getAddress(recovered) !== getAddress(requirements.payer)) {
    return { valid: false, error: "signature does not match payer" };
  }

  return { valid: true, payer: getAddress(recovered) };
}

export type SignTypedData = (args: {
  domain: ReturnType<typeof permitDomain>;
  types: typeof PERMIT_TYPES;
  primaryType: "Permit";
  message: ReturnType<typeof permitMessage>;
}) => Promise<Hex>;

export type PaidResult<T> = {
  data: T;
  paid: boolean;
  settlement?: {
    txHash: string;
    settled: boolean;
    explorerUrl?: string;
    note?: string;
  };
};

/**
 * Call an M402-gated endpoint: try, get 402, sign, retry.
 *
 * `payer` goes out on the first request so the server can read that account's
 * permit nonce when it builds the challenge.
 */
export async function callPaidAPI<TInput, TOutput>(
  url: string,
  input: TInput,
  payment: { payer: Address; signTypedData: SignTypedData },
): Promise<PaidResult<TOutput>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-PAYER": payment.payer,
  };
  const body = JSON.stringify(input);

  const first = await fetch(url, { method: "POST", headers, body });
  if (first.status !== 402) {
    if (!first.ok) {
      const err = (await first.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Agent failed (${first.status})`);
    }
    return { data: (await first.json()) as TOutput, paid: false };
  }

  const required = first.headers.get("X-PAYMENT-REQUIRED");
  if (!required) throw new Error("402 without X-PAYMENT-REQUIRED");

  const requirements = decodeRequirements(required);
  const signature = await payment.signTypedData({
    domain: permitDomain(requirements),
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: permitMessage(requirements),
  });

  const second = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "X-PAYMENT": encodePayment({
        payer: payment.payer,
        nonce: requirements.nonce,
        deadline: requirements.deadline,
        signature,
      }),
    },
    body,
  });

  if (!second.ok) {
    const err = (await second.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Payment rejected (${second.status})`);
  }

  const data = (await second.json()) as TOutput & PaidResult<TOutput>;
  return { data, paid: true, settlement: data.settlement };
}
