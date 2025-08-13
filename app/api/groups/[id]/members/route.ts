// app/api/groups/[id]/members/route.ts
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

// GET /api/groups/:id/members?details=1
export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = ctx?.params?.id;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const url = new URL(req.url);
  const details = url.searchParams.get("details");

  if (details) {
    const rows = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
    });
    const payload = rows.map((m: { userId: string; user: { id: string; name: string | null } | null }) => ({
      userId: m.userId,
      name: m.user?.name ?? null,
    }));
    return NextResponse.json(payload);
  }

  const rows = await prisma.groupMember.findMany({
    where: { groupId: id },
    select: { userId: true },
    orderBy: { userId: "asc" },
  });
  const ids: string[] = rows.map((r: { userId: string }) => r.userId);
  return NextResponse.json(ids);
}

// POST /api/groups/:id/members { userId }
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const groupId = ctx?.params?.id;
  if (!groupId) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
  const userId = String(body?.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const exists = await prisma.groupMember.findFirst({ where: { groupId, userId }, select: { id: true } });
  if (exists) return NextResponse.json({ ok: true, id: exists.id });

  const gm = await prisma.groupMember.create({ data: { groupId, userId }, select: { id: true } });
  return NextResponse.json({ ok: true, id: gm.id }, { status: 201 });
}

// DELETE /api/groups/:id/members?userId=...
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const groupId = ctx?.params?.id;
  if (!groupId) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const url = new URL(req.url);
  const userIdRaw = url.searchParams.get("userId");
  const userId = String(userIdRaw ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await prisma.groupMember.deleteMany({ where: { groupId, userId } });
  return NextResponse.json({ ok: true });
}
