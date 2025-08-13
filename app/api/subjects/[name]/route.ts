// app/api/subjects/[name]/route.ts
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
    } catch {}
  }
  return s.split(/[,;\/|]+/g).map((x) => x.trim()).filter(Boolean);
}
function toStore(arr: string[]) { return JSON.stringify(arr); }

// PATCH /api/subjects/:name { name: newName }
export async function PATCH(req: Request, ctx: { params: { name: string } }) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const oldName = decodeURIComponent(ctx?.params?.name ?? "").trim();
  if (!oldName) return NextResponse.json({ error: "missing name" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const newName = String(body?.name ?? "").trim();
  if (!newName) return NextResponse.json({ error: "new name required" }, { status: 400 });
  if (oldName === newName) return NextResponse.json({ ok: true, renamed: 0 });

  // Переименуем в каталоге
  const exists = await prisma.subject.findUnique({ where: { name: oldName } });
  if (!exists) {
    // если старого нет — просто создадим новый
    await prisma.subject.upsert({ where: { name: newName }, create: { name: newName }, update: {} });
  } else {
    // если новый уже есть — удалим старый, иначе — переименуем
    const dup = await prisma.subject.findUnique({ where: { name: newName } });
    if (dup) {
      await prisma.subject.delete({ where: { name: oldName } });
    } else {
      await prisma.subject.update({ where: { name: oldName }, data: { name: newName } });
    }
  }

  // Пройдёмся по пользователям — заменим в JSON-списке
  const users = await prisma.user.findMany({ select: { id: true, subjects: true } });
  let renamed = 0;
  for (const u of users) {
    const list = parseSubjects(u.subjects);
    if (!list.includes(oldName)) continue;
    const next = Array.from(new Set(list.map((s) => (s === oldName ? newName : s))));
    await prisma.user.update({ where: { id: u.id }, data: { subjects: toStore(next) } });
    renamed++;
  }

  return NextResponse.json({ ok: true, renamed });
}

// DELETE /api/subjects/:name  → удалить из каталога и у всех пользователей
export async function DELETE(_req: Request, ctx: { params: { name: string } }) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const name = decodeURIComponent(ctx?.params?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });

  // удалить у пользователей
  const users = await prisma.user.findMany({ select: { id: true, subjects: true } });
  let removed = 0;
  for (const u of users) {
    const list = parseSubjects(u.subjects);
    if (!list.includes(name)) continue;
    const next = list.filter((s) => s !== name);
    await prisma.user.update({ where: { id: u.id }, data: { subjects: toStore(next) } });
    removed++;
  }

  // удалить из каталога
  await prisma.subject.deleteMany({ where: { name } });

  return NextResponse.json({ ok: true, removed });
}
