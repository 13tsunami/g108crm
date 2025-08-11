// app/api/chat/threads/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function pairKey(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `direct:${x}:${y}`;
}

export async function POST(req: NextRequest) {
  const meId = "me-dev";
  const { otherUserId } = await req.json();

  if (!otherUserId || typeof otherUserId !== "string") {
    return NextResponse.json({ error: "otherUserId is required" }, { status: 400 });
  }
  if (otherUserId === meId) {
    return NextResponse.json({ error: "cannot chat with self" }, { status: 400 });
  }

  const title = pairKey(meId, otherUserId);

  const existing = await prisma.thread.findFirst({ where: { title }, select: { id: true } });
  if (existing) return NextResponse.json({ threadId: existing.id });

  const created = await prisma.thread.create({ data: { title } });
  return NextResponse.json({ threadId: created.id }, { status: 201 });
}
