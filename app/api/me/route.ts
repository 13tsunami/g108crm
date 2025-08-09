import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FALLBACK_ROLES } from "@/lib/edu";

/**
 * Пока нет реальной аутентификации — берём «текущего» пользователя так:
 * - если в .env задан ROOT_USER_IDS — находим по нему (первый попавшийся id),
 * - иначе берём первого пользователя из базы.
 * Отдаём и старое поле role (строка), и нормализованный массив roles.
 */
export async function GET() {
  try {
    const rootIds = (process.env.ROOT_USER_IDS || "")
      .split(",").map((s) => s.trim()).filter(Boolean);

    let me =
      (rootIds.length
        ? await prisma.user.findFirst({ where: { id: { in: rootIds } } })
        : null) ||
      (await prisma.user.findFirst({}));

    if (!me) return NextResponse.json({ error: "NO_USER" });

    const byName = new Map(FALLBACK_ROLES.map((r) => [r.name, r]));
    const bySlug = new Map(FALLBACK_ROLES.map((r) => [r.slug, r]));
    const primary =
      byName.get(me.role ?? "") ||
      bySlug.get(String(me.role ?? "").toLowerCase()) ||
      FALLBACK_ROLES[FALLBACK_ROLES.length - 1];

    const roles = [{ name: primary.name, slug: primary.slug, power: primary.power }];

    return NextResponse.json({
      id: me.id,
      name: me.name,
      email: me.email,
      phone: me.phone,
      birthday: me.birthday,
      classroom: me.classroom,
      role: me.role,
      roles,
      power: primary.power,
      isRoot: rootIds.includes(me.id),
      createdAt: me.createdAt,
      updatedAt: me.updatedAt,
    });
  } catch {
    return NextResponse.json({ error: "NO_USER" });
  }
}
