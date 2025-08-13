// app/api/groups/route.ts
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
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(2000, Math.max(1, parseInt(url.searchParams.get("limit") ?? "1000", 10) || 1000));

  const where: any = q ? { name: { contains: q, mode: "insensitive" } } : {};

  const groups = await prisma.group.findMany({
    where,
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit,
  });

  return NextResponse.json(groups, { status: 200 });
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return bad("Invalid JSON"); }
  const name = String(body?.name ?? "").trim();
  const id = body?.id ? String(body.id) : undefined;
  if (!name) return bad("name is required");

  const created = await prisma.group.create({
    data: id ? { id, name } : { name },
    select: { id: true, name: true },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
