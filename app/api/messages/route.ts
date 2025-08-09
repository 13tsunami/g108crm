// app/api/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const threads = await prisma.thread.findMany({
    include: { messages: { include: { author: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(threads);
}

export async function POST(req: NextRequest) {
  const { threadTitle, text, authorId } = await req.json();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  let thread = await prisma.thread.findFirst({ where: { title: threadTitle ?? null } });
  if (!thread) thread = await prisma.thread.create({ data: { title: threadTitle ?? null } });

  const msg = await prisma.message.create({
    data: { text, authorId: authorId ?? null, threadId: thread.id },
    include: { author: true, thread: true },
  });

  return NextResponse.json(msg, { status: 201 });
}
