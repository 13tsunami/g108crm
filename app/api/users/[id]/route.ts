// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
const db = prisma as any;

type GroupRow = { name: string };

function toStrArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [];
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await db.user.findUnique({
      where: { id: params.id },
      include: { roles: { include: { role: true } } },
    });
    if (!u) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const rows = await db.$queryRaw<GroupRow[]>`
      SELECT g.name as name
      FROM GroupMember gm
      JOIN "Group" g ON g.id = gm.groupId
      WHERE gm.userId = ${params.id}
    `;

    return NextResponse.json({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      birthday: u.birthday,
      classroom: u.classroom,
      roles: (u.roles || []).map((x: any) => x.role),
      groups: (rows as GroupRow[]).map((r: GroupRow) => r.name),
      subjects: toStrArray(u.subjects),
      methodicalGroups: toStrArray(u.methodicalGroups),
    });
  } catch (e) {
    console.error("GET /api/users/[id] failed:", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { name, email, phone, roleSlug, birthday, classroom, subjects, methodicalGroups } = (await req.json()) as any;

    if (roleSlug) {
      const role = await db.role.findUnique({ where: { slug: roleSlug } });
      if (!role) return NextResponse.json({ error: "ROLE_NOT_FOUND" }, { status: 404 });
      await db.userRole.deleteMany({ where: { userId: params.id } });
      await db.userRole.create({ data: { userId: params.id, roleId: role.id } });
    }

    const user = await db.user.update({
      where: { id: params.id },
      data: {
        name: name?.trim(),
        email: email?.trim() ?? undefined,
        phone: phone?.trim() ?? undefined,
        birthday: birthday ? new Date(birthday) : undefined,
        classroom: classroom ?? undefined,
        subjects: subjects !== undefined ? toStrArray(subjects) : undefined,
        methodicalGroups: methodicalGroups !== undefined ? toStrArray(methodicalGroups) : undefined,
      } as any,
      include: { roles: { include: { role: true } } },
    });

    const rows = await db.$queryRaw<GroupRow[]>`
      SELECT g.name as name
      FROM GroupMember gm
      JOIN "Group" g ON g.id = gm.groupId
      WHERE gm.userId = ${params.id}
    `;

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      birthday: user.birthday,
      classroom: user.classroom,
      role: user.roles.map((x: any) => x.role.name).join(", "),
      roles: user.roles.map((x: any) => x.role),
      groups: (rows as GroupRow[]).map((r: GroupRow) => r.name),
      subjects: toStrArray(user.subjects),
      methodicalGroups: toStrArray(user.methodicalGroups),
    });
  } catch (e: any) {
    if (String(e.code) === "P2002") return NextResponse.json({ error: "UNIQUE_CONSTRAINT" }, { status: 409 });
    if (String(e.code) === "P2025") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    console.error("PATCH /api/users/[id] failed:", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await db.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e.code) === "P2025") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    console.error("DELETE /api/users/[id] failed:", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
