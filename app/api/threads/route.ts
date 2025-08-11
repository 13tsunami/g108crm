// app/api/threads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET() {
  const rows = await prisma.thread.findMany({
    orderBy: { title: "asc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { id: true, name: true } } }
      }
    }
  });
  const data = rows.map(t => ({
    id: t.id,
    title: t.title,
    lastMessageText: t.messages[0]?.text ?? null,
    lastMessageAt: t.messages[0]?.createdAt?.toISOString?.() ?? null
  }));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { title } = await req.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const created = await prisma.thread.create({ data: { title: title.trim() } });
  return NextResponse.json({ id: created.id, title: created.title }, { status: 201 });
}
