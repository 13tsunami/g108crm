// app/api/groups/[id]/members/route.ts
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

// Возвращаем МАССИВ userId[] — именно это удобно TaskForm.resolveGroupMembers
export async function GET(_: NextRequest, { params }: { params: { id?: string } }) {
  const id = params?.id?.trim();
  if (!id) return bad("group id is required", 400);

  const exists = await prisma.group.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return bad("Group not found", 404);

  const members = await prisma.groupMember.findMany({
    where: { groupId: id },
    select: { userId: true },
    orderBy: { userId: "asc" },
    take: 5000,
  });

  const userIds = members.map(m => m.userId);
  return NextResponse.json(userIds, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
