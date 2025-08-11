// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function parseArr(s?: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
function strArr(a: any): string {
  return JSON.stringify(Array.isArray(a) ? a : []);
}

const SELECT = {
  id: true, name: true, email: true, phone: true, classroom: true, role: true,
  subjects: true, methodicalGroups: true, avatarUrl: true, telegram: true, about: true,
  notifyEmail: true, notifyTelegram: true,
} as const;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const u = await prisma.user.findUnique({ where: { id: params.id }, select: SELECT });
  if (!u) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    ...u,
    subjects: parseArr(u.subjects),
    methodicalGroups: parseArr(u.methodicalGroups),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const {
    name, email, phone, roleSlug, role, classroom,
    subjects, methodicalGroups, groups,
    telegram, avatarUrl, about,
    notifyEmail, notifyTelegram,
    password,
  } = body || {};

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (classroom !== undefined) data.classroom = classroom || null;
  if (roleSlug !== undefined || role !== undefined) data.role = (roleSlug ?? role) || null;
  if (subjects !== undefined) data.subjects = strArr(subjects);
  if (methodicalGroups !== undefined || groups !== undefined) data.methodicalGroups = strArr(methodicalGroups ?? groups);
  if (telegram !== undefined) data.telegram = telegram || null;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;
  if (about !== undefined) data.about = about || null;
  if (notifyEmail !== undefined) data.notifyEmail = !!notifyEmail;
  if (notifyTelegram !== undefined) data.notifyTelegram = !!notifyTelegram;

  if (password) {
    data.passwordHash = await bcrypt.hash(String(password), 10);
  }

  try {
    const updated = await prisma.user.update({ where: { id: params.id }, data, select: SELECT });
    return NextResponse.json({
      ...updated,
      subjects: parseArr(updated.subjects),
      methodicalGroups: parseArr(updated.methodicalGroups),
    });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "UNIQUE_CONSTRAINT" }, { status: 409 });
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
