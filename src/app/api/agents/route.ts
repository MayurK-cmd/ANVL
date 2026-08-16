import { NextResponse } from "next/server";
import { deployEnabled, verifyDeployKey } from "@/lib/keys";
import {
  catalog,
  saveAgent,
  toAgent,
  uploadedAgents,
  validateManifest,
} from "@/lib/registry";

/** Writes to disk and reads a deploy key — never prerender or cache. */
export const dynamic = "force-dynamic";

/** GET /api/agents — the catalog the Store renders. */
export async function GET(request: Request) {
  const uploadedOnly = new URL(request.url).searchParams.get("uploaded") === "1";
  const agents = uploadedOnly ? uploadedAgents() : await catalog();
  return NextResponse.json({ agents, count: agents.length });
}

/** POST /api/agents — the target of `anvil deploy`. */
export async function POST(request: Request) {
  if (!deployEnabled()) {
    // Refusing beats defaulting open: this endpoint writes to the filesystem.
    return NextResponse.json(
      {
        error:
          "Store has no deploy key — uploads are disabled. Create one at /keys, or set ANVIL_DEPLOY_KEY.",
      },
      { status: 503 },
    );
  }

  if (!verifyDeployKey(request.headers.get("x-anvil-key") ?? "")) {
    return NextResponse.json({ error: "bad deploy key" }, { status: 401 });
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const errors = validateManifest(manifest);
  if (errors.length) {
    return NextResponse.json(
      { error: "manifest failed validation", details: errors },
      { status: 422 },
    );
  }

  const agent = toAgent(manifest);
  const { updated } = saveAgent(agent);

  return NextResponse.json(
    { ok: true, updated, id: agent.id, endpoint: agent.endpoint },
    { status: updated ? 200 : 201 },
  );
}
