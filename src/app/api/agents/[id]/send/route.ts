import { NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import {
  decodePayment,
  encodeRequirements,
  verifyPayment,
} from "@/lib/m402";
import { generatePaymentRequirements, settle } from "@/lib/facilitator";
import { requireAgent, runAgent } from "@/lib/run-agent";
import { withOnChainData } from "@/lib/registry";

/** Settlement signs with the facilitator key — never prerender or cache this. */
export const dynamic = "force-dynamic";

/**
 * ponytail: in-memory replay guard, single instance only. Redundant once
 * settlement is on (the token's permit nonce is the real guard), but without it
 * a dev-mode signature is replayable forever. Swap for Redis if this ever runs
 * on more than one node.
 */
const spent = new Set<string>();

function challenge(requirements: unknown, error: string) {
  return NextResponse.json(
    { error },
    {
      status: 402,
      headers: {
        "X-PAYMENT-REQUIRED": encodeRequirements(
          requirements as Parameters<typeof encodeRequirements>[0],
        ),
        "Access-Control-Expose-Headers": "X-PAYMENT-REQUIRED",
      },
    },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let agent;
  try {
    agent = requireAgent(id);
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // The amount charged is on-chain truth, not the static fixture number —
  // `updatePrice`/`deactivate` on AgentRegistry take effect immediately.
  const live = await withOnChainData(agent);
  if (!live) {
    return NextResponse.json({ error: "Agent is deactivated" }, { status: 404 });
  }
  agent = live;

  const payerHeader = request.headers.get("X-PAYER") ?? "";
  if (!isAddress(payerHeader)) {
    return NextResponse.json(
      { error: "send your address in X-PAYER to get a payment challenge" },
      { status: 400 },
    );
  }
  const payer = getAddress(payerHeader);

  let input: Record<string, unknown> = {};
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    input = {};
  }

  const requirements = await generatePaymentRequirements({
    payer,
    amount: agent.amount,
    agentId: agent.id,
    description: `${agent.id} — 1 call`,
  });

  const paymentHeader = request.headers.get("X-PAYMENT") ?? "";
  const checked = await verifyPayment(paymentHeader, requirements);
  if (!checked.valid) {
    return challenge(requirements, checked.error);
  }

  const payload = decodePayment(paymentHeader);
  const spendKey = `${agent.id}:${checked.payer}:${payload.nonce}:${payload.deadline}`;
  if (spent.has(spendKey)) {
    return challenge(requirements, "payment already used");
  }
  spent.add(spendKey);

  // Run first, settle second: a payer is never charged for a failed agent.
  let executed;
  try {
    executed = await runAgent(agent, input);
  } catch (error) {
    spent.delete(spendKey);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "agent failed" },
      { status: 500 },
    );
  }

  try {
    const settlement = await settle(payload, requirements);
    return NextResponse.json({ ...executed, settlement });
  } catch (error) {
    spent.delete(spendKey);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `settlement failed: ${error.message}`
            : "settlement failed",
      },
      { status: 502 },
    );
  }
}
