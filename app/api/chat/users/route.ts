import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function getUserId(req: NextRequest) {
  const h = req.headers.get("x-user-id"); if (h) return h;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)uid=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  const users = await prisma.user.findMany({
    where: uid ? { id: { not: uid } } : undefined,
    select: { id: true, name: true, email: true },
    take: 500,
    orderBy: [{ name: "asc" }],
  });
  return NextResponse.json(users);
}
