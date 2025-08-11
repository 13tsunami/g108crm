import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth.config";
import { hash } from "bcryptjs";
import { parseStrArray, toDbStrArray } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (d: unknown, i: ResponseInit = {}) =>
  new Response(JSON.stringify(d), {
    status: i.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v);
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return isNaN(d.getTime()) ? null : d;
}
function canManage(s: any) {
  const r = s?.user?.role as string | undefined;
  return r === "director" || r === "deputy_plus";
}
function normEmail(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /\S+@\S+\.\S+/.test(s) ? s : s;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const u = (await (prisma as any).user.findUnique({
    where: { id: params.id },
  })) as any;
  if (!u) return json({ error: "Не найдено" }, { status: 404 });
  return json({
    ...u,
    birthday: u.birthday ? new Date(u.birthday).toISOString() : null,
    subjects: parseStrArray(u.subjects),
    methodicalGroups: parseStrArray(u.methodicalGroups),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!canManage(session))
    return json({ error: "Недостаточно прав" }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const data: any = {};
  if (typeof b?.name === "string") data.name = b.name.trim();
  if (typeof b?.username === "string" || b?.username === null) data.username = b.username?.trim() || null;
  if (b?.email !== undefined) data.email = normEmail(b.email);
  if (typeof b?.phone === "string" || b?.phone === null) data.phone = b.phone || null;
  if (typeof b?.classroom === "string" || b?.classroom === null) data.classroom = b.classroom || null;
  if (typeof b?.roleSlug === "string" || typeof b?.role === "string")
    data.role = (b?.roleSlug as string) ?? (b?.role as string);
  if (b?.birthday !== undefined) data.birthday = toDateOrNull(b.birthday);
  if (b?.subjects !== undefined) data.subjects = toDbStrArray(b.subjects);
  if (b?.methodicalGroups !== undefined)
    data.methodicalGroups = toDbStrArray(b.methodicalGroups);
  if (typeof b?.about === "string" || b?.about === null) data.about = b.about ?? null;
  if (typeof b?.telegram === "string" || b?.telegram === null) data.telegram = b.telegram ?? null;
  if (typeof b?.avatarUrl === "string" || b?.avatarUrl === null) data.avatarUrl = b.avatarUrl ?? null;
  if (typeof b?.notifyEmail === "boolean") data.notifyEmail = b.notifyEmail;
  if (typeof b?.notifyTelegram === "boolean") data.notifyTelegram = b.notifyTelegram;
  if (typeof b?.password === "string" && b.password.trim())
    data.passwordHash = await hash(b.password.trim(), 10);

  const updated = (await (prisma as any).user.update({
    where: { id: params.id },
    data,
  })) as any;

  return json({
    ...updated,
    birthday: updated.birthday
      ? new Date(updated.birthday).toISOString()
      : null,
    subjects: parseStrArray(updated.subjects),
    methodicalGroups: parseStrArray(updated.methodicalGroups),
  });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  return PATCH(req, ctx);
}
