// app/api/chat/search-users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { getMe } from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function maskToLike(raw: string) {
  const esc = raw.replace(/([_%\\])/g, "\\$1").replace(/\*/g, "%").replace(/\?/g, "_");
  return raw.includes("*") || raw.includes("?") ? esc : `%${esc}%`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([]);

  const me = await getMe(prisma, req);
  const tokens = q.split(/\s+/).filter(Boolean).map(maskToLike);

  const clauses = tokens.map(tok =>
    Prisma.sql`(LOWER(name) LIKE LOWER(${tok}) ESCAPE '\\' OR LOWER(id) LIKE LOWER(${tok}) ESCAPE '\\')`
  );

  // <-- ВАЖНО: второй аргумент — строка
  const whereAnd = clauses.length ? Prisma.join(clauses, " AND ") : Prisma.sql`1=1`;
  const excludeSelf = me ? Prisma.sql` AND id <> ${me.id} ` : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string; name: string | null }[]>(Prisma.sql`
    SELECT id, name
    FROM User
    WHERE ${whereAnd} ${excludeSelf}
    ORDER BY name ASC
    LIMIT 20
  `);

  return NextResponse.json(rows);
}
