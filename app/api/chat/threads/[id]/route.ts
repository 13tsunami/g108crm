// app/api/chat/threads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pushThreadUpdated } from "../../_bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// минимальная утилита userId
function getUserId(req: NextRequest): string | null {
  const h = req.headers.get("x-user-id");
  if (h && h.trim()) return h.trim();
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)uid=([^;]+)/i);
  if (m) { try { return decodeURIComponent(m[1]); } catch {} }
  return null;
}

// GET — отдать тред и сообщения после clearedAt (как делали ранее)
// (можешь оставить свой GET, если уже ок)

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = getUserId(req);
  if (!uid) return new NextResponse(null, { status: 401 });

  // soft-delete для конкретного пользователя + обрезаем историю с текущего момента
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ChatState"(threadId,userId,hiddenAt,clearedAt)
     VALUES(?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(threadId,userId) DO UPDATE
     SET hiddenAt=CURRENT_TIMESTAMP, clearedAt=CURRENT_TIMESTAMP;`,
    params.id, uid
  );

  // обновить списки/бейджи у этого пользователя
  pushThreadUpdated([uid]);

  // правильный ответ для DELETE
  return new NextResponse(null, { status: 204 });
}
