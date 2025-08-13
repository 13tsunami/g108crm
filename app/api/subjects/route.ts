// app/api/subjects/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
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

/** Подсчёт { предмет → кол-во пользователей } из поля User.subjects */
async function countFromUsers(): Promise<{ name: string; count: number }[]> {
  const users = await prisma.user.findMany({
    select: { subjects: true },
    take: 20000,
  });
  const counts = new Map<string, number>();
  for (const u of users) {
    for (const s of parseSubjects(u.subjects)) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

// GET /api/subjects  → [{ name, count }]
export async function GET() {
  try {
    // Основной путь: читаем каталог Subject
    const catalog = await prisma.subject.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });

    const users = await prisma.user.findMany({
      select: { subjects: true },
      take: 20000,
    });

    const counts = new Map<string, number>();
    for (const row of catalog) counts.set(row.name, 0);
    for (const u of users) {
      for (const s of parseSubjects(u.subjects)) {
        if (counts.has(s)) counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }

    const items = catalog.map((row: { name: string }) => ({
      name: row.name,
      count: counts.get(row.name) ?? 0,
    }));
    return NextResponse.json(items);
  } catch (e: any) {
    // Если нет таблицы Subject — отдаём фолбэк из User.subjects
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      const fallback = await countFromUsers();
      return NextResponse.json(fallback);
    }
    console.error("GET /api/subjects failed:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

// POST /api/subjects { name, userIds?: string[] }
// создаёт запись в Subject (если нет), и опционально массово назначает
export async function POST(req: Request) {
  const role = await getSessionRole();
  if (!canManage(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; userIds?: unknown };
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const ids: string[] = Array.isArray(body?.userIds)
    ? (body!.userIds as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  try {
    // создаём/гарантируем наличие записи в каталоге
    await prisma.subject.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      // Нет миграции каталога Subject
      return NextResponse.json(
        {
          error: "subject_catalog_missing",
          message:
            "Каталог предметов не инициализирован. Выполните миграцию Prisma для модели Subject (см. инструкции).",
        },
        { status: 400 }
      );
    }
    console.error("POST /api/subjects upsert failed:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, name, assigned: 0 });
  }

  // назначение выбранным пользователям
  const toStore = (arr: string[]) => JSON.stringify(arr);
  let assigned = 0;
  for (const uid of ids) {
    // eslint-disable-next-line no-await-in-loop
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { subjects: true } });
    if (!u) continue;
    const list = parseSubjects(u.subjects);
    if (list.includes(name)) continue;
    const next = [...list, name];
    // eslint-disable-next-line no-await-in-loop
    await prisma.user.update({ where: { id: uid }, data: { subjects: toStore(next) } });
    assigned++;
  }

  return NextResponse.json({ ok: true, name, assigned });
}
