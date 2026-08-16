import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import {
  encodePayment,
  permitDomain,
  permitMessage,
  PERMIT_TYPES,
  verifyPayment,
  type PaymentRequirements,
} from "./m402";

const PAYER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const OTHER_KEY =
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as Hex;

const payer = privateKeyToAccount(PAYER_KEY);
const other = privateKeyToAccount(OTHER_KEY);

const NOW = 1_760_000_000;

function requirements(
  overrides: Partial<PaymentRequirements> = {},
): PaymentRequirements {
  return {
    scheme: "permit",
    chainId: 10143,
    payTo: "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c",
    spender: "0x000000000000000000000000000000000000f402",
    token: "0x0000000000000000000000000000000000000a02",
    tokenName: "Anvil",
    tokenVersion: "1",
    amount: "10000",
    agentId: "echo-v1",
    payer: payer.address,
    nonce: "0",
    deadline: NOW + 120,
    description: "echo-v1 — 1 call",
    ...overrides,
  };
}

async function sign(
  req: PaymentRequirements,
  account = payer,
): Promise<string> {
  const signature = await account.signTypedData({
    domain: { ...permitDomain(req) },
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: { ...permitMessage(req) },
  });
  return encodePayment({
    payer: req.payer,
    nonce: req.nonce,
    deadline: req.deadline,
    signature,
  });
}

describe("m402 verifyPayment", () => {
  it("rejects a missing payment", async () => {
    const result = await verifyPayment("", requirements(), NOW);
    assert.equal(result.valid, false);
  });

  it("accepts a correctly signed permit", async () => {
    const req = requirements();
    const result = await verifyPayment(await sign(req), req, NOW);
    assert.equal(result.valid, true);
    if (result.valid) assert.equal(result.payer, payer.address);
  });

  it("rejects a signature over a smaller amount", async () => {
    // Payer signs for 1 base unit; the server is charging 10000.
    const cheap = await sign(requirements({ amount: "1" }));
    const result = await verifyPayment(cheap, requirements(), NOW);
    assert.equal(result.valid, false);
    if (!result.valid) assert.equal(result.error, "signature does not match payer");
  });

  it("rejects a signature for a different recipient chain", async () => {
    const wrongChain = await sign(requirements({ chainId: 1 }));
    const result = await verifyPayment(wrongChain, requirements(), NOW);
    assert.equal(result.valid, false);
  });

  it("rejects an expired deadline", async () => {
    const req = requirements({ deadline: NOW - 1 });
    const result = await verifyPayment(await sign(req), req, NOW);
    assert.equal(result.valid, false);
    if (!result.valid) assert.equal(result.error, "payment signature expired");
  });

  it("rejects a deadline stretched beyond the accepted window", async () => {
    const req = requirements({ deadline: NOW + 86_400 });
    const result = await verifyPayment(await sign(req), req, NOW);
    assert.equal(result.valid, false);
    if (!result.valid)
      assert.equal(result.error, "deadline too far in the future");
  });

  it("rejects a valid signature from somebody else's key", async () => {
    const req = requirements();
    const impostor = await sign(req, other);
    const result = await verifyPayment(impostor, req, NOW);
    assert.equal(result.valid, false);
  });

  it("rejects a payer that does not match the challenge", async () => {
    const req = requirements();
    const signed = await sign(requirements({ payer: other.address }), other);
    const result = await verifyPayment(signed, req, NOW);
    assert.equal(result.valid, false);
    if (!result.valid)
      assert.equal(result.error, "payer does not match the issued challenge");
  });
});
