// app/api/groups/[id]/route.ts
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

// PATCH /api/groups/:id { name }
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = ctx?.params?.id;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const g = await prisma.group.update({ where: { id }, data: { name }, select: { id: true, name: true } });
  return NextResponse.json(g);
}

// DELETE /api/groups/:id
export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = ctx?.params?.id;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
