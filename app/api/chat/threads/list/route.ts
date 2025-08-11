// app/api/chat/threads/list/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function parsePeer(title: string, meId: string): string | null {
  const m = /^direct:(.+):(.+)$/.exec(title);
  if (!m) return null;
  const [a, b] = [m[1], m[2]];
  return a === meId ? b : b === meId ? a : null;
}

export async function GET() {
  const meId = "me-dev";

  // Берём треды формата direct:* с последним сообщением
  const rows = await prisma.thread.findMany({
    where: { title: { startsWith: "direct:" } },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { id: true, name: true } } }
      }
    }
  });

  // Оставляем только треды, где участвует текущий пользователь
  const withMe = rows
    .map(t => {
      const peerId = parsePeer(t.title, meId);
      if (!peerId) return null;
      return { t, peerId };
    })
    .filter(Boolean) as Array<{ t: typeof rows[number]; peerId: string }>;

  // Подтягиваем имена собеседников одним запросом
  const users = await prisma.user.findMany({
    where: { id: { in: withMe.map(x => x.peerId) } },
    select: { id: true, name: true }
  });
  const nameById = new Map(users.map(u => [u.id, u.name]));

  const data = withMe
    .map(({ t, peerId }) => ({
      id: t.id,
      peerId,
      peerName: nameById.get(peerId) ?? null,
      lastMessageText: t.messages[0]?.text ?? null,
      lastMessageAt: t.messages[0]?.createdAt?.toISOString?.() ?? null
    }))
    // Сортируем по дате последнего сообщения на стороне JS
    .sort((a, b) => {
      const ax = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const bx = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return bx - ax;
    });

  return NextResponse.json(data);
}
