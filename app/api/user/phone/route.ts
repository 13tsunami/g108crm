// app/api/user/phone/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { can } from "@/lib/rbac";

export async function PATCH(req: Request) {
  const actorId = (req.headers.get("x-user-id") || "").trim();
  if (!actorId) return NextResponse.json({ error: "NO_USER" }, { status: 401 });

  const { userId, phone } = await req.json();
  const targetId: string = (userId || actorId) as string;

  if (typeof phone !== "string" || phone.replace(/\D/g, "").length < 7) {
    return NextResponse.json({ error: "BAD_PHONE" }, { status: 400 });
  }

  const allowed =
    (targetId === actorId && (await can(actorId, "user.updatePhone:self"))) ||
    (targetId !== actorId && (await can(actorId, "user.updatePhone:any")));

  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { phone },
      select: { id: true, phone: true },
    });
    return NextResponse.json(user);
  } catch (e: any) {
    if (String(e.code) === "P2002") return NextResponse.json({ error: "PHONE_TAKEN" }, { status: 409 });
    if (String(e.code) === "P2025") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
