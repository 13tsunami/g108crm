// app/api/chat/threads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pushThreadDeleted, pushThreadUpdated } from "../../_bus";
const prisma = new PrismaClient();

function uid(req: NextRequest) {
  const v = req.headers.get("x-user-id");
  if (!v) throw new Error("Unauthorized");
  return String(v);
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const userId = uid(req);
    const threadId = ctx.params.id;

    const t = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!t) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    if (t.aId !== userId && t.bId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // удаляем все сущности этого треда
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { threadId } }),
      prisma.chatRead.deleteMany({ where: { threadId } }),
      prisma.thread.delete({ where: { id: threadId } }),
    ]);

    // пуш обоим участникам
    pushThreadDeleted(t.aId, threadId);
    pushThreadDeleted(t.bId, threadId);
    // на всякий — и updated (если фронт подписан только на него)
    pushThreadUpdated(t.aId, threadId);
    pushThreadUpdated(t.bId, threadId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
