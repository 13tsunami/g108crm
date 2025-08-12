// app/api/chat/threads/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function uid(req: NextRequest) {
  const v = req.headers.get("x-user-id");
  if (!v) throw new Error("Unauthorized");
  return String(v);
}

export async function GET(req: NextRequest) {
  try {
    const userId = uid(req);

    const threads = await prisma.thread.findMany({
      where: { OR: [{ aId: userId }, { bId: userId }] },
      include: {
        a: { select: { id: true, name: true } },
        b: { select: { id: true, name: true } },
      },
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    });

    const ids = threads.map(t => t.id);
    const reads = await prisma.chatRead.findMany({
      where: { userId, threadId: { in: ids.length ? ids : ["_"] } },
      select: { threadId: true, lastReadAt: true },
    });
    const readMap = new Map(reads.map(r => [r.threadId, r.lastReadAt]));

    // считаем непрочитанные: сообщения от собеседника новее моего lastReadAt
    const result = await Promise.all(threads.map(async (t) => {
      const peerId = t.aId === userId ? t.bId : t.aId;
      const peerName = t.aId === userId ? t.b.name : t.a.name;
      const lastReadAt = readMap.get(t.id) ?? new Date(0);

      const unreadCount = await prisma.message.count({
        where: {
          threadId: t.id,
          createdAt: { gt: lastReadAt },
          authorId: { not: userId },
        },
      });

      return {
        id: t.id,
        peerId,
        peerName,
        lastMessageText: t.lastMessageText,
        lastMessageAt: t.lastMessageAt,
        unreadCount,
      };
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
