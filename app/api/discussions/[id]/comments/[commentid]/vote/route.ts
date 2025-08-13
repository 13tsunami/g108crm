// app/api/discussions/[id]/comments/[commentId]/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { initDbOnce, getPost, voteComment, getAuth } from "../../../../_store";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  await initDbOnce();
  const { uid } = getAuth(req);
  if (!uid) return new NextResponse("Unauthorized: X-User-Id required", { status: 401 });

  const { id, commentId } = await ctx.params;
  const p = getPost(id);
  if (!p) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => null) as { value?: 1 | -1 | 0 } | null;
  const value = typeof body?.value === "number" ? (body!.value as 1 | -1 | 0) : 0;

  const res = await voteComment(id, commentId, uid, value);
  if (!res) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(res);
}
