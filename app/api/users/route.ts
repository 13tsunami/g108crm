// app/api/users/route.ts
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type J = Record<string, unknown>;
const json = (data: J, init: ResponseInit = { status: 200 }) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { username: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { classroom: { contains: q } },
            { role: { contains: q } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ name: "asc" }, { username: "asc" }],
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        birthday: true,
        classroom: true,
        role: true,
      },
    });

    return json({ users, count: users.length });
  } catch (e: any) {
    console.error("[/api/users][GET] error:", e);
    return json({ error: e?.message ?? "Internal error", users: [], count: 0 }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const data = {
      name: body?.name?.toString().trim() || null,
      username: body?.username?.toString().trim() || null,
      email: body?.email?.toString().trim().toLowerCase() || null,
      phone: body?.phone?.toString().trim() || null,
      birthday: body?.birthday ? new Date(body.birthday) : null,
      classroom: body?.classroom?.toString().trim() || null,
      role: body?.role?.toString().trim() || null,
    };

    const user = await prisma.user.create({
      data,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        birthday: true,
        classroom: true,
        role: true,
      },
    });

    return json({ ok: true, user }, { status: 201 });
  } catch (e: any) {
    // P2002 — нарушение уникальности
    const status = e?.code === "P2002" ? 409 : 500;
    console.error("[/api/users][POST] error:", e);
    return json({ ok: false, error: e?.message ?? "Internal error" }, { status });
  }
}
