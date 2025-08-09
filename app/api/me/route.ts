// app/api/me/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type RoleOut = { id: string; name: string; slug: string; power: number };

export async function GET(req: Request) {
  const userId = (req.headers.get("x-user-id") || "").trim();
  if (!userId) return NextResponse.json({ error: "NO_USER" }, { status: 401 });

  // Берём базовые поля пользователя (те, что IDE уже знает)
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      birthday: true,
      classroom: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!me) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Роли грузим отдельным запросом (типозависимости нет)
  const roles = await prisma.$queryRaw<RoleOut[]>`
    SELECT r.id, r.name, r.slug, r.power
    FROM Role r
    JOIN UserRole ur ON ur.roleId = r.id
    WHERE ur.userId = ${userId}
    ORDER BY r.power DESC
  `;

  return NextResponse.json({ ...me, roles });
}
