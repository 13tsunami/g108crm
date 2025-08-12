import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function getUserId(req: NextRequest) {
  const h = req.headers.get("x-user-id"); if (h) return h;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)uid=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const { otherUserId } = await req.json().catch(() => ({}));
  if (!otherUserId || otherUserId === uid) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const [aId, bId] = [uid, otherUserId].sort();
  const th = await prisma.thread.upsert({
    where: { aId_bId: { aId, bId } } as any,
    create: { aId, bId, title: "" } as any,
    update: {},
    select: { id: true },
  });

  // раскрываем и ставим/обновляем барьер: clearedAt = MAX(existing, now)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ChatState"(threadId,userId,hiddenAt,clearedAt)
     VALUES(?, ?, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT(threadId,userId) DO UPDATE
     SET hiddenAt=NULL,
         clearedAt=MAX(COALESCE("ChatState".clearedAt, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP);`,
    th.id, uid
  );

  return NextResponse.json({ threadId: th.id });
}
