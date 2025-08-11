// app/api/messages/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET() {
  // Последние 50 сообщений глобально
  const rows = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { id: true, name: true } } }
  });

  const data = rows.map(m => ({
    id: m.id,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    author: { id: m.author?.id ?? "", name: m.author?.name ?? null },
    threadId: m.threadId
  }));

  return NextResponse.json(data);
}
