import { NextResponse } from "next/server";
import { createKey, listKeys } from "@/lib/keys";

/** Reads and writes deploy keys on disk — never prerender or cache. */
export const dynamic = "force-dynamic";

/** GET /api/keys — metadata only. The plaintext key is never readable again. */
export async function GET() {
  return NextResponse.json({
    keys: listKeys(),
    envKeySet: Boolean(process.env.ANVIL_DEPLOY_KEY),
  });
}

/** POST /api/keys — mint a key. The response is the only time it is shown. */
export async function POST(request: Request) {
  let body: { label?: unknown } = {};
  try {
    body = (await request.json()) as { label?: unknown };
  } catch {
    // An unlabelled key is fine; createKey names it.
  }

  const label = typeof body.label === "string" ? body.label.slice(0, 60) : "";
  const { key, record } = createKey(label);

  return NextResponse.json({ key, record }, { status: 201 });
}
