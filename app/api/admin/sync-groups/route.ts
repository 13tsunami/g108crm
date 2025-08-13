// app/api/admin/sync-groups/route.ts
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

type ImportedGroup = { name: string; users: string[] };

// POST /api/admin/sync-groups
export async function POST(_req: Request) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let data: ImportedGroup[] = [];

  try {
    const mod: any = await import("@/lib/edu");
    const groups1: unknown = mod?.GROUPS ?? mod?.groups ?? [];

    if (Array.isArray(groups1) && groups1.length) {
      data = groups1
        .map((g: any) => ({
          name: String(g?.name ?? "").trim(),
          users: Array.isArray(g?.users)
            ? (g.users as unknown[]).map((x: unknown) => String(x ?? "").trim()).filter((x: string) => !!x)
            : [],
        }))
        .filter((g: ImportedGroup) => g.name);
    } else if (mod?.METHODICAL && typeof mod.METHODICAL === "object") {
      const o = mod.METHODICAL as Record<string, unknown>;
      data = Object.keys(o).map((name: string) => {
        const arr: unknown[] = Array.isArray(o[name]) ? (o[name] as unknown[]) : [];
        const users: string[] = arr.map((x: unknown) => String(x ?? "").trim()).filter((x: string) => !!x);
        return { name, users };
      });
    }
  } catch {
    return NextResponse.json({ ok: true, imported: 0 });
  }

  let imported = 0;
  for (const g of data) {
    let db = await prisma.group.findFirst({ where: { name: g.name }, select: { id: true, name: true } });
    if (!db) {
      db = await prisma.group.create({ data: { name: g.name }, select: { id: true, name: true } });
    }

    const current = await prisma.groupMember.findMany({ where: { groupId: db.id }, select: { userId: true } });
    const have = new Set<string>(current.map((x: { userId: string }) => x.userId));
    const need = new Set<string>(g.users);

    const toDel: string[] = [...have].filter((u: string) => !need.has(u));
    if (toDel.length) {
      await prisma.groupMember.deleteMany({ where: { groupId: db.id, userId: { in: toDel } } });
    }

    const toAdd: string[] = [...need].filter((u: string) => !have.has(u));
    for (const uid of toAdd) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.groupMember.create({ data: { groupId: db.id, userId: uid } }).catch(() => {});
    }
    imported++;
  }

  return NextResponse.json({ ok: true, imported });
}
