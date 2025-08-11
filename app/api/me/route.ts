// app/api/me/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as RBAC from "@/lib/rbac";

function parseArr(s?: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    // выбираем только реально существующие в схеме поля
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      phone: true,
      role: true,
      birthday: true,
      classroom: true,
      avatarUrl: true,
      telegram: true,
      about: true,
      notifyEmail: true,
      notifyTelegram: true,
      subjects: true,
      methodicalGroups: true,
    },
  });
  if (!me) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // флаг рута вычисляем в коде, не из БД
  let isRoot = false;
  try {
    if (typeof (RBAC as any)?.isRootUser === "function") {
      isRoot = !!(RBAC as any).isRootUser(me);
    } else {
      isRoot = me.name === "Евжик Иван Сергеевич";
    }
  } catch { isRoot = me.name === "Евжик Иван Сергеевич"; }

  const dto = {
    ...me,
    subjects: parseArr((me as any).subjects),
    methodicalGroups: parseArr((me as any).methodicalGroups),
    isRoot,
  };

  return NextResponse.json(dto);
}
