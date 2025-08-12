import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pushTyping } from "../_bus";
const prisma = new PrismaClient();

function getUserId(req: NextRequest) {
  const h = req.headers.get("x-user-id"); if (h) return h;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)uid=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  const { threadId } = await req.json().catch(() => ({}));
  if (!uid || !threadId) return NextResponse.json({ ok: false });

  const t = await prisma.thread.findUnique({ where: { id: threadId } }) as any;
  if (!t) return NextResponse.json({ ok: false });
  const to = t.aId === uid ? [t.bId] : t.bId === uid ? [t.aId] : [];
  if (to.length) pushTyping(to, threadId);
  return NextResponse.json({ ok: true });
}
