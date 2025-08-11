// app/api/chat/threads/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getMe, pairKey } from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { otherUserId } = await req.json();
  if (!otherUserId || typeof otherUserId !== "string") {
    return NextResponse.json({ error: "otherUserId is required" }, { status: 400 });
  }

  const me = await getMe(prisma, req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (otherUserId === me.id) return NextResponse.json({ error: "cannot chat with self" }, { status: 400 });

  const other = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
  if (!other) return NextResponse.json({ error: "other user not found" }, { status: 404 });

  const title = pairKey(me.id, otherUserId);
  const existing = await prisma.thread.findFirst({ where: { title }, select: { id: true } });
  if (existing) return NextResponse.json({ threadId: existing.id });

  const created = await prisma.thread.create({ data: { title } });
  return NextResponse.json({ threadId: created.id }, { status: 201 });
}
