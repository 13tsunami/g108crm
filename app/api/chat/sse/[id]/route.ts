// app/api/chat/threads/[id]/messages/route.ts  — ПОЛНЫЙ ФАЙЛ
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { publishMessage } from "@/lib/chatSSE";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(_: NextRequest, ctx: { params: { id: string } }) {
  const { id } = ctx.params;
  const items = await prisma.message.findMany({
    where: { threadId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } }
  });
  const data = items.map(m => ({
    id: m.id,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    author: { id: m.author?.id ?? "", name: m.author?.name ?? null }
  }));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const meId = "me-dev"; // позже заменишь на id пользователя из сессии
  const { id } = ctx.params;
  const { text } = await req.json() as { text?: string };

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const created = await prisma.message.create({
    data: { text: text.trim(), authorId: meId, threadId: id }
  });

  const me = await prisma.user.findUnique({ where: { id: meId }, select: { name: true } });
  publishMessage(id, {
    id: created.id,
    text: created.text,
    createdAt: created.createdAt.toISOString(),
    author: { id: meId, name: me?.name ?? null }
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
