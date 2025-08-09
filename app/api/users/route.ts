// app/api/users/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
const db = prisma as any;

function toStrArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const where: any = q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { classroom: { contains: q } }, { role: { contains: q } }] }
      : undefined;

    const users = await db.user.findMany({
      where,
      orderBy: { name: "asc" },
      include: { roles: { include: { role: true } } },
    });

    const data = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      birthday: u.birthday,
      classroom: u.classroom,
      role: u.roles?.length ? u.roles.map((x: any) => x.role.name).join(", ") : (u.role || ""),
      roles: (u.roles || []).map((x: any) => x.role),
      // новые поля для редактирования
      subjects: toStrArray(u.subjects),
      methodicalGroups: toStrArray(u.methodicalGroups),
    }));

    return NextResponse.json(data);
  } catch (e) {
    console.error("GET /api/users failed:", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, roleSlug, birthday, classroom, subjects, methodicalGroups } = body as any;

    if (!name?.trim() || !roleSlug?.trim()) {
      return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
    }

    const role = await db.role.findUnique({ where: { slug: roleSlug } });
    if (!role) return NextResponse.json({ error: "ROLE_NOT_FOUND" }, { status: 404 });

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        birthday: birthday ? new Date(birthday) : null,
        classroom: classroom || null,
        subjects: toStrArray(subjects),
        methodicalGroups: toStrArray(methodicalGroups),
        roles: { create: { roleId: role.id } },
      } as any,
      include: { roles: { include: { role: true } } },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      birthday: user.birthday,
      classroom: user.classroom,
      role: user.roles.map((x: any) => x.role.name).join(", "),
      roles: user.roles.map((x: any) => x.role),
      subjects: toStrArray(user.subjects),
      methodicalGroups: toStrArray(user.methodicalGroups),
    });
  } catch (e: any) {
    if (String(e.code) === "P2002") {
      return NextResponse.json({ error: "UNIQUE_CONSTRAINT" }, { status: 409 });
    }
    console.error("POST /api/users failed:", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
