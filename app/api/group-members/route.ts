// app/api/group-members/route.ts
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const groupId = (url.searchParams.get("groupId") ?? "").trim();
  if (!groupId) return bad("groupId is required", 400);

  const exists = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!exists) return bad("Group not found", 404);

  const members = await prisma.groupMember.findMany({
    where: { groupId },
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
