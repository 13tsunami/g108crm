// app/api/chat/threads/[id]/read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { publishRead } from "@/lib/chatSSE";
import { getMe, parsePeer } from "../../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const me = await getMe(prisma, req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = ctx.params;
  const thread = await prisma.thread.findUnique({ where: { id }, select: { title: true } });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });
  const peerId = parsePeer(thread.title, me.id);
  if (!peerId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const my = await prisma.chatRead.findUnique({ where: { threadId_userId: { threadId: id, userId: me.id } } });
  const peer = await prisma.chatRead.findUnique({ where: { threadId_userId: { threadId: id, userId: peerId } } });

  return NextResponse.json({
    myReadAt: my?.lastReadAt?.toISOString?.() ?? null,
    peerReadAt: peer?.lastReadAt?.toISOString?.() ?? null
  });
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const me = await getMe(prisma, req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = ctx.params;

  const saved = await prisma.chatRead.upsert({
    where: { threadId_userId: { threadId: id, userId: me.id } },
    update: { lastReadAt: new Date() },
    create: { threadId: id, userId: me.id }
  });

  publishRead(id, { userId: me.id, readAt: saved.lastReadAt.toISOString() });

  return NextResponse.json({ ok: true });
}
