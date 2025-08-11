// app/api/chat/search-users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { getMe } from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * Переводим пользовательскую маску в шаблон для LIKE.
 * - Экранируем спецсимволы LIKE: _ % \
 * - '*' -> '%', '?' -> '_'
 * - если маски нет — ищем по подстроке: %q%
 */
function maskToLike(raw: string) {
  const esc = raw
    .replace(/([_%\\])/g, "\\$1")
    .replace(/\*/g, "%")
    .replace(/\?/g, "_");
  return raw.includes("*") || raw.includes("?") ? esc : `%${esc}%`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (!q) return NextResponse.json([]);

    // кто делает запрос — чтобы исключить себя из результатов
    const me = await getMe(prisma, req).catch(() => null);

    const tokens = q.split(/\s+/).filter(Boolean).map(maskToLike);
    if (!tokens.length) return NextResponse.json([]);

    // для каждого токена ищем по нескольким полям
    const perTokenClause = (tok: string) =>
      Prisma.sql`(
        LOWER("name")     LIKE LOWER(${tok}) ESCAPE '\\'
        OR LOWER("username") LIKE LOWER(${tok}) ESCAPE '\\'
        OR LOWER("email")    LIKE LOWER(${tok}) ESCAPE '\\'
        OR LOWER("phone")    LIKE LOWER(${tok}) ESCAPE '\\'
        OR LOWER("id")       LIKE LOWER(${tok}) ESCAPE '\\'
      )`;

    const clauses = tokens.map(perTokenClause);
    const andWhere = Prisma.join(clauses, " AND ");

    // собираем финальный запрос
    const rows = await prisma.$queryRaw<
      { id: string; name: string | null; username: string | null; email: string | null }[]
    >(Prisma.sql`
      SELECT "id", "name", "username", "email"
      FROM "User"
      WHERE ${andWhere}
      ${me ? Prisma.sql`AND "id" <> ${me.id}` : Prisma.sql``}
      ORDER BY "name" ASC
      LIMIT 20
    `);

    // Небольшая защита от дублей и пустых имён
    const cleaned = rows.map(r => ({
      id: r.id,
      name: r.name ?? r.username ?? r.email ?? r.id,
    }));

    return NextResponse.json(cleaned);
  } catch (e) {
    // на крайний случай отдаём пустой массив, чтобы фронт не падал на парсинге
    return NextResponse.json([]);
  }
}
