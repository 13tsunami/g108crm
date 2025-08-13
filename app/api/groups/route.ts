// app/api/groups/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const prisma = (global as any).prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") (global as any).prisma = prisma;

export const dynamic = "force-dynamic";

function canManage(role?: string | null) {
  const s = (role ?? "").toLowerCase();
  return s === "director" || s === "deputy_plus";
}

async function getSessionRole(): Promise<string | undefined> {
  try {
    const session: any = await getServerSession(authOptions as any);
    const r = session?.user?.role ?? session?.user?.roleSlug ?? null;
    return typeof r === "string" ? r : undefined;
  } catch {
    return undefined;
  }
}

// GET /api/groups?limit=5000
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limitNum = Number(limitRaw);
  const limit = Number.isFinite(limitNum) ? Math.min(limitNum, 10_000) : 1000;

  const list = await prisma.group.findMany({
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true },
  });
  return NextResponse.json(list);
}

// POST /api/groups { name }
export async function POST(req: Request) {
  const role = await getSessionRole();
  if (!canManage(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const raw = String(body?.name ?? "").trim();
  if (!raw) return NextResponse.json({ error: "name required" }, { status: 400 });

  const exists = await prisma.group.findFirst({ where: { name: raw }, select: { id: true } });
  if (exists) return NextResponse.json({ id: exists.id, name: raw }, { status: 200 });

  const g = await prisma.group.create({ data: { name: raw }, select: { id: true, name: true } });
  return NextResponse.json(g, { status: 201 });
}
