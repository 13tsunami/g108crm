// app/api/chat/threads/[id]/read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pushThreadUpdated } from "../../../_bus";
const prisma = new PrismaClient();

function uid(req: NextRequest) {
  const v = req.headers.get("x-user-id");
  if (!v) throw new Error("Unauthorized");
  return String(v);
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const userId = uid(req);
    const threadId = ctx.params.id;

    const t = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!t) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    if (t.aId !== userId && t.bId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const me = await prisma.chatRead.findUnique({ where: { threadId_userId: { threadId, userId } } });
    const otherId = t.aId === userId ? t.bId : t.aId;
    const peer = await prisma.chatRead.findUnique({ where: { threadId_userId: { threadId, userId: otherId } } });

    return NextResponse.json({
      myReadAt: me?.lastReadAt ? me.lastReadAt.toISOString() : null,
      peerReadAt: peer?.lastReadAt ? peer.lastReadAt.toISOString() : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const userId = uid(req);
    const threadId = ctx.params.id;

    const t = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!t) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    if (t.aId !== userId && t.bId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();
    await prisma.chatRead.upsert({
      where: { threadId_userId: { threadId, userId } },
      update: { lastReadAt: now },
      create: { threadId, userId, lastReadAt: now },
    });

    // обновим списки у обоих
    const otherId = t.aId === userId ? t.bId : t.aId;
    pushThreadUpdated(userId, threadId);
    pushThreadUpdated(otherId, threadId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
