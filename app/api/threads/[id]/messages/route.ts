// app/api/threads/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

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
  const { id } = ctx.params;
  const { text, authorId }:{ text?:string; authorId?:string } = await req.json();
  if (!text || !authorId) {
    return NextResponse.json({ error: "text and authorId are required" }, { status: 400 });
  }
  const created = await prisma.message.create({
    data: { text: text.trim(), authorId, threadId: id }
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
