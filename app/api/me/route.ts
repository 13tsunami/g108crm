// app/api/me/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth.config";
import { parseStrArray } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (d: unknown, i: ResponseInit = {}) =>
  new Response(JSON.stringify(d), { status: i.status ?? 200, headers: { "content-type": "application/json; charset=utf-8" } });

export async function GET() {
  const session = await getServerSession(authOptions);
  const uid = (session as any)?.user?.id as string | undefined;
  if (!uid) return json({ error: "Не авторизован" }, { status: 401 });

  const u = (await prisma.user.findUnique({ where: { id: uid } })) as any;
  if (!u) return json({ error: "Пользователь не найден" }, { status: 404 });

  return json({
    id: u.id,
    name: u.name ?? null,
    email: u.email ?? null,
    phone: u.phone ?? null,
    username: u.username ?? null,
    role: u.role ?? null,
    classroom: u.classroom ?? null,
    birthday: u.birthday ? new Date(u.birthday).toISOString() : null,
    avatarUrl: u.avatarUrl ?? null,
    image: u.image ?? null,
    telegram: u.telegram ?? null,
    about: u.about ?? null,
    notifyEmail: !!u.notifyEmail,
    notifyTelegram: !!u.notifyTelegram,
    subjects: parseStrArray(u.subjects),
    methodicalGroups: parseStrArray(u.methodicalGroups),
  });
}
