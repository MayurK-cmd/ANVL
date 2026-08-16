import { NextResponse } from "next/server";
import { revokeKey } from "@/lib/keys";

export const dynamic = "force-dynamic";

/** DELETE /api/keys/:id — revoke. Deploys using it start failing immediately. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!revokeKey(id)) {
    return NextResponse.json({ error: "key not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id });
}
