// app/api/chat/search-users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const meId = "me-dev";
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) return NextResponse.json([]);

  // Без mode: 'insensitive' — для совместимости с твоей версией Prisma/SQLite.
  const rows = await prisma.user.findMany({
    where: {
      id: { not: meId },
      OR: [
        { name: { contains: q } },
        { id:   { contains: q } },
      ],
    },
    select: { id: true, name: true },
    take: 20,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(rows);
}
