import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseArr(s?: string | null): string[] { if (!s) return []; try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } }
function strArr(a: any): string { return JSON.stringify(Array.isArray(a) ? a : []); }

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!me) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const u = me as any;
  return NextResponse.json({
    ...me,
    subjects: parseArr(u.subjects),
    methodicalGroups: parseArr(u.methodicalGroups),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "BAD_JSON" }, { status: 400 }); }

  const data: any = {};
  if ("phone" in body) data.phone = body.phone || null;
  if ("classroom" in body) data.classroom = body.classroom || null;
  if ("telegram" in body) data.telegram = body.telegram || null;
  if ("avatarUrl" in body) data.avatarUrl = body.avatarUrl || null;
  if ("about" in body) data.about = body.about || null;
  if ("notifyEmail" in body) data.notifyEmail = !!body.notifyEmail;
  if ("notifyTelegram" in body) data.notifyTelegram = !!body.notifyTelegram;
  if ("birthday" in body) data.birthday = body.birthday ? new Date(body.birthday) : null;

  if ("subjects" in body) data.subjects = strArr(body.subjects);
  if ("methodicalGroups" in body || "groups" in body) data.methodicalGroups = strArr(body.methodicalGroups ?? body.groups);

  delete body.name; delete body.email; delete body.role; delete body.username;

  try {
    const updated = await prisma.user.update({ where: { id: session.user.id }, data: data as any });
    const u = updated as any;
    return NextResponse.json({
      ...updated,
      subjects: parseArr(u.subjects),
      methodicalGroups: parseArr(u.methodicalGroups),
    });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "UNIQUE_CONSTRAINT" }, { status: 409 });
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
