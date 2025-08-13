// app/api/chat/groups/[id]/members/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as any;
const prisma: PrismaClient = g.prisma ?? new PrismaClient();
if (!g.prisma) g.prisma = prisma;

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

// GET ?details=1 — вернёт [{userId,name}], иначе ["userId",...]
export async function GET(req: NextRequest, { params }: { params: { id?: string } }) {
  const id = params?.id?.trim();
  if (!id) return bad("group id is required");

  const url = new URL(req.url);
  const details = (url.searchParams.get("details") ?? "").toLowerCase() === "1";

  const rows = await prisma.groupMember.findMany({
    where: { groupId: id },
    select: {
      userId: true,
      ...(details ? { user: { select: { name: true } } } : {}),
    } as any,
    orderBy: { userId: "asc" },
    take: 5000,
  });

  if (details) {
    return NextResponse.json(rows.map((r: any) => ({ userId: r.userId, name: r.user?.name ?? null })), { status: 200 });
  }
  return NextResponse.json(rows.map(r => r.userId), { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: { id?: string } }) {
  const id = params?.id?.trim();
  if (!id) return bad("group id is required");
  let body: any; try { body = await req.json(); } catch { return bad("Invalid JSON"); }
  const userId = String(body?.userId ?? "").trim();
  if (!userId) return bad("userId is required");

  // так как нет @@unique([userId, groupId]) — проверим вручную
  const exists = await prisma.groupMember.findFirst({ where: { userId, groupId: id }, select: { id: true } });
  if (!exists) {
    await prisma.groupMember.create({ data: { userId, groupId: id } });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id?: string } }) {
  const id = params?.id?.trim();
  if (!id) return bad("group id is required");
  const url = new URL(req.url);
  const userId = (url.searchParams.get("userId") ?? "").trim();
  if (!userId) return bad("userId is required");
  await prisma.groupMember.deleteMany({ where: { userId, groupId: id } });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
