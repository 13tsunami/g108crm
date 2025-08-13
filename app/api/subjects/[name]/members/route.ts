// app/api/subjects/[name]/members/route.ts
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
  } catch { return undefined; }
}

function parseSubjects(raw: unknown): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.map((x) => String(x ?? "").trim()).filter(Boolean);
    } catch { /* ignore */ }
  }
  return s.split(/[,;\/|]+/g).map((x) => x.trim()).filter(Boolean);
}
function toStore(arr: string[]): string {
  return JSON.stringify(arr);
}

// GET /api/subjects/:name/members?details=1
export async function GET(req: Request, ctx: { params: { name: string } }) {
  const subject = decodeURIComponent(ctx?.params?.name ?? "").trim();
  if (!subject) return NextResponse.json({ error: "missing subject" }, { status: 400 });

  const url = new URL(req.url);
  const details = url.searchParams.get("details");

  // членство читаем из users.subjects (совместимо со старым)
  const users = await prisma.user.findMany({
    select: { id: true, name: true, subjects: true },
    orderBy: { name: "asc" },
    take: 20000,
  });

  type URow = { id: string; name: string | null; subjects: string | null };
  const list: URow[] = users.filter((u: URow) => parseSubjects(u.subjects).includes(subject));

  if (details) {
    const payload = list.map((u: URow) => ({ userId: u.id, name: u.name ?? null }));
    return NextResponse.json(payload);
  }
  return NextResponse.json(list.map((u: URow) => u.id));
}

// POST /api/subjects/:name/members { userId }
export async function POST(req: Request, ctx: { params: { name: string } }) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const subject = decodeURIComponent(ctx?.params?.name ?? "").trim();
  if (!subject) return NextResponse.json({ error: "missing subject" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
  const userId = String(body?.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // гарантируем, что предмет есть в каталоге
  await prisma.subject.upsert({ where: { name: subject }, create: { name: subject }, update: {} });

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { subjects: true } });
  if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const list = parseSubjects(u.subjects);
  if (!list.includes(subject)) {
    const next = [...list, subject];
    await prisma.user.update({ where: { id: userId }, data: { subjects: toStore(next) } });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/subjects/:name/members?userId=...
export async function DELETE(req: Request, ctx: { params: { name: string } }) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const subject = decodeURIComponent(ctx?.params?.name ?? "").trim();
  if (!subject) return NextResponse.json({ error: "missing subject" }, { status: 400 });

  const url = new URL(req.url);
  const userId = String(url.searchParams.get("userId") ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { subjects: true } });
  if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const list = parseSubjects(u.subjects);
  const next = list.filter((s) => s !== subject);
  await prisma.user.update({ where: { id: userId }, data: { subjects: toStore(next) } });

  return NextResponse.json({ ok: true });
}
