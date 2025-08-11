// app/api/presence/route.ts
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type J = Record<string, unknown>;
const json = (data: J, init?: ResponseInit) => Response.json(data, init);

async function hasCol(col: string) {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>("PRAGMA table_info('User');");
  return rows.some((r) => r.name === col);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return json({ error: "id обязателен" }, { status: 400 });

    if (await hasCol("lastSeen")) {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "lastSeen" = CURRENT_TIMESTAMP WHERE "id" = ?`,
        id
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, username: true },
    });

    return json({ ok: true, user });
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return json({ error: "id обязателен" }, { status: 400 });

    let lastSeen: string | null = null;
    if (await hasCol("lastSeen")) {
      const row = await prisma.$queryRawUnsafe<{ lastSeen: string | null }[]>(
        `SELECT "lastSeen" FROM "User" WHERE "id" = ?`,
        id
      );
      lastSeen = row?.[0]?.lastSeen ?? null;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, username: true },
    });

    const now = Date.now();
    const seen = lastSeen ? new Date(lastSeen).getTime() : 0;
    const online = lastSeen ? seen > 0 && now - seen <= 5 * 60 * 1000 : null;

    return json({ ok: true, user, lastSeen, online });
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
