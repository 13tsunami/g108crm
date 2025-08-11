// app/api/chat/threads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getMe, parsePeer } from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const me = await getMe(prisma, req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = ctx.params;
  const t = await prisma.thread.findUnique({ where: { id }, select: { title: true } });
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });

  // удалять может только участник
  if (!parsePeer(t.title, me.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.message.deleteMany({ where: { threadId: id } });
  await prisma.chatRead.deleteMany({ where: { threadId: id } });
  await prisma.thread.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
