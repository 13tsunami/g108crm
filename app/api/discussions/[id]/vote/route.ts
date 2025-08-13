// app/api/discussions/[id]/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { initDbOnce, votePost, getPost, getAuth } from "../../_store";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await initDbOnce();
  const { uid } = getAuth(req);
  if (!uid) return new NextResponse("Unauthorized: X-User-Id required", { status: 401 });

  const { id } = await ctx.params;
  if (!getPost(id)) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => null) as { value?: 1 | -1 | 0 } | null;
  const value = typeof body?.value === "number" ? (body!.value as 1 | -1 | 0) : 0;

  const updated = await votePost(id, uid, value);
  return NextResponse.json(updated);
}
