import { NextResponse } from "next/server";
import { openZeptoSession } from "@/lib/run-agent";

/** Brings the automated browser session forward — never runs the agent, never pays, never places an order. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let mode: "checkout" | "login" = "checkout";
  try {
    const body = (await request.json()) as { mode?: string };
    if (body.mode === "login") mode = "login";
  } catch {
    // no body — default to checkout
  }

  const result = await openZeptoSession(mode);
  return NextResponse.json(result);
}
