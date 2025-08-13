// app/api/groups/[id]/route.ts
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

export async function GET(_: NextRequest, { params }: { params: { id?: string } }) {
  const id = params?.id?.trim();
  if (!id) return bad("id is required");
  const gRow = await prisma.group.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!gRow) return bad("Group not found", 404);
  return NextResponse.json(gRow, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id?: string } }) {
  const id = params?.id?.trim();
  if (!id) return bad("id is required");
  let body: any; try { body = await req.json(); } catch { return bad("Invalid JSON"); }
  const name = String(body?.name ?? "").trim();
  if (!name) return bad("name is required");

  const upd = await prisma.group.update({ where: { id }, data: { name }, select: { id: true, name: true } });
  return NextResponse.json(upd, { status: 200 });
}

export async function DELETE(_: NextRequest, { params }: { params: { id?: string } }) {
  const id = params?.id?.trim();
  if (!id) return bad("id is required");
  // GroupMember.onDelete: Cascade — но подчистим явно
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.deleteMany({ where: { groupId: id } });
    await tx.group.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true, deleted: id }, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
