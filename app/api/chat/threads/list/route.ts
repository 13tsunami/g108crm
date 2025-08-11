// app/api/chat/threads/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getMe, parsePeer } from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const me = await getMe(prisma, req);
  if (!me) return NextResponse.json([], { status: 401 });

  // ограничим сразу на уровне БД
  const rows = await prisma.thread.findMany({
    where: {
      OR: [
        { title: { startsWith: `direct:${me.id}:` } },
        { title: { endsWith: `:${me.id}` } },
      ],
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { id: true, name: true } } }
      }
    }
  });

  const items = await Promise.all(rows.map(async t => {
    const peerId = parsePeer(t.title, me.id)!;
    const peer = await prisma.user.findUnique({ where: { id: peerId }, select: { name: true } });

    const myRead = await prisma.chatRead.findUnique({
      where: { threadId_userId: { threadId: t.id, userId: me.id } },
      select: { lastReadAt: true }
    });
    const myReadAt = myRead?.lastReadAt ?? new Date(0);

    const peerRead = await prisma.chatRead.findUnique({
      where: { threadId_userId: { threadId: t.id, userId: peerId } },
      select: { lastReadAt: true }
    });

    const unreadCount = await prisma.message.count({
      where: { threadId: t.id, createdAt: { gt: myReadAt }, NOT: { authorId: me.id } }
    });

    return {
      id: t.id,
      peerId,
      peerName: peer?.name ?? null,
      lastMessageText: t.messages[0]?.text ?? null,
      lastMessageAt: t.messages[0]?.createdAt?.toISOString?.() ?? null,
      unreadCount,
      peerReadAt: peerRead?.lastReadAt?.toISOString?.() ?? null
    };
  }));

  // сортировка по последнему сообщению
  items.sort((a, b) => {
    const ax = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bx = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return bx - ax;
  });

  return NextResponse.json(items);
}
