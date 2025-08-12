// app/api/chat/threads/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pushMessage, pushThreadUpdated } from "../../../_bus";
const prisma = new PrismaClient();

function uid(req: NextRequest) {
  const v = req.headers.get("x-user-id");
  if (!v) throw new Error("Unauthorized");
  return String(v);
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const threadId = ctx.params.id;
    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    });
    // Приводим к твоему фронтовому формату
    const out = messages.map(m => ({
      id: m.id,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
      author: { id: m.author.id, name: m.author.name },
    }));
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const userId = uid(req);
    const threadId = ctx.params.id;
    const body = await req.json().catch(() => ({} as any));
    const text: string = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Empty" }, { status: 400 });

    const t = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!t) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    if (t.aId !== userId && t.bId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const msg = await prisma.message.create({
      data: { threadId, authorId: userId, text },
      include: { author: { select: { id: true, name: true } } },
    });

    const now = new Date();
    await prisma.$transaction([
      prisma.thread.update({
        where: { id: threadId },
        data: { lastMessageAt: now, lastMessageText: text },
      }),
      prisma.chatRead.upsert({
        where: { threadId_userId: { threadId, userId } },
        update: { lastReadAt: now },
        create: { threadId, userId, lastReadAt: now },
      }),
    ]);

    // пушим обоим
    const otherId = t.aId === userId ? t.bId : t.aId;
    // полезная нагрузка — как фронт ждёт
    const data = { id: msg.id, text: msg.text, createdAt: msg.createdAt.toISOString(), author: { id: msg.author.id, name: msg.author.name } };
    pushMessage(userId, threadId, data);
    pushMessage(otherId, threadId, data);
    pushThreadUpdated(userId, threadId);
    pushThreadUpdated(otherId, threadId);

    return NextResponse.json({ id: msg.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
