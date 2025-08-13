// app/api/tasks/[id]/assignees/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as any;
const prisma: PrismaClient = g.prisma ?? new PrismaClient();
if (!g.prisma) g.prisma = prisma;

export async function PATCH(req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const { id, userId } = params;
    const body = await req.json().catch(() => ({}));
    const status = body?.status === "done" ? "done" : "open";
    const data = status === "done" ? { status, doneAt: new Date() } : { status, doneAt: null };

    const updated = await prisma.taskAssignee.updateMany({
      where: { taskId: id, userId },
      data,
    });

    if (updated.count === 0) {
      return NextResponse.json({ ok: false, error: "Assignee not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error("assignee PATCH error:", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
