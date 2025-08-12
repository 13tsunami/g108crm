import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pushMessage, pushThreadUpdated } from "../../../_bus";
const prisma = new PrismaClient();

function getUserId(req: NextRequest) {
  const h = req.headers.get("x-user-id"); if (h) return h;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)uid=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

async function getClearedAt(threadId: string, userId: string) {
  const row = await prisma.$queryRawUnsafe<{ clearedAt: string | null }[]>(
    `SELECT clearedAt FROM "ChatState" WHERE threadId = ? AND userId = ? LIMIT 1;`,
    threadId, userId
  );
  return row?.[0]?.clearedAt ? new Date(row[0].clearedAt) : new Date(0);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = getUserId(req);
  const since = uid ? await getClearedAt(params.id, uid) : new Date(0);

  const msgs = await prisma.message.findMany({
    where: { threadId: params.id, createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, createdAt: true, author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(
    msgs.map(m => ({
      id: m.id,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
      author: { id: m.author.id, name: m.author.name },
    }))
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { text } = await req.json().catch(() => ({}));
  if (!text || !String(text).trim()) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const th = await prisma.thread.findUnique({ where: { id: params.id } }) as any;
  if (!th) return NextResponse.json({ ok: false }, { status: 404 });
  if (th.aId && th.bId && th.aId !== uid && th.bId !== uid) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // если у отправителя тред был скрыт — расскрываем (но clearedAt не трогаем)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ChatState"(threadId,userId,hiddenAt,clearedAt)
     VALUES(?,?,NULL,NULL)
     ON CONFLICT(threadId,userId) DO UPDATE SET hiddenAt=NULL;`,
    th.id, uid
  );

  const msg = await prisma.message.create({
    data: { threadId: th.id, authorId: uid, text: String(text).trim() },
    select: { id: true, text: true, createdAt: true, author: { select: { id: true, name: true } } },
  });

  await prisma.$executeRawUnsafe(
    `UPDATE "Thread" SET "lastMessageAt" = ?, "lastMessageText" = ? WHERE "id" = ?;`,
    msg.createdAt, msg.text, th.id
  );

  await prisma.chatRead.upsert({
    where: { threadId_userId: { threadId: th.id, userId: uid } },
    create: { threadId: th.id, userId: uid, lastReadAt: msg.createdAt },
    update: { lastReadAt: msg.createdAt },
  });

  const to = [th.aId, th.bId].filter(Boolean);
  pushMessage(to, th.id, {
    id: msg.id, text: msg.text,
    createdAt: msg.createdAt.toISOString(),
    author: { id: msg.author.id, name: msg.author.name },
  });
  pushThreadUpdated(to);

  return NextResponse.json({ ok: true, message: msg });
}
