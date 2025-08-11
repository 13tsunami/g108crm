// app/api/chat/threads/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { publishMessage } from "@/lib/chatSSE";
import { getMe } from "../../../_utils";

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
  const me = await getMe(prisma, req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = ctx.params;
  const { text } = await req.json() as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const created = await prisma.message.create({
    data: { text: text.trim(), authorId: me.id, threadId: id }
  });

  publishMessage(id, {
    id: created.id,
    text: created.text,
    createdAt: created.createdAt.toISOString(),
    author: { id: me.id, name: me.name ?? null }
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
