// app/api/discussions/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { initDbOnce, listComments, addComment, getPost, getAuth } from "../../_store";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await initDbOnce();
  const { id } = await ctx.params;
  const data = listComments(id);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await initDbOnce();
  const { uid, name } = getAuth(req);
  if (!uid) return new NextResponse("Unauthorized: X-User-Id required", { status: 401 });
  const { id } = await ctx.params;
  const p = getPost(id);
  if (!p) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => null) as { text?: string } | null;
  const text = (body?.text || "").trim();
  if (!text) return new NextResponse("Empty", { status: 400 });

  const c = await addComment(id, uid, name, text);
  return NextResponse.json(c);
}
