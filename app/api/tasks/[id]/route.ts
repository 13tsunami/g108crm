import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split(".");
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const toPriority = (p: any) =>
  String(p || "").toUpperCase() === "HIGH" || String(p).toLowerCase() === "high"
    ? "HIGH"
    : "NORMAL";

/** PATCH /api/tasks/:id — обновление/архивация (совместимость со старым фронтом: { hidden:true } = удалить) */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body: any = await req.json();

    // старое поведение — архивировать/удалить
    if (body?.hidden === true) {
      await prisma.$transaction(async (tx) => {
        await tx.taskAssignment.deleteMany({ where: { taskId: params.id } });
        await tx.task.delete({ where: { id: params.id } });
      });
      return new Response(null, { status: 204 });
    }

    const title       = body.title ? String(body.title).trim() : undefined;
    const description = body.description !== undefined ? String(body.description ?? "") : undefined;
    const due         = parseDate(body.dueDate);
    const priority    = body.priority !== undefined ? toPriority(body.priority) : undefined;

    // 🔧 Явно приводим к string[]
    let assignees: string[] | undefined;
    if (Array.isArray(body.assignees)) {
      assignees = Array.from(
        new Set((body.assignees as unknown[]).map((x) => String(x)).filter(Boolean))
      );
    }

    await prisma.task.update({
      where: { id: params.id },
      data: { title, description, dueDate: due ?? undefined, priority },
    });

    if (assignees) {
      await prisma.taskAssignment.deleteMany({ where: { taskId: params.id } });
      if (assignees.length) {
        await prisma.taskAssignment.createMany({
          data: assignees.map((userId) => ({ taskId: params.id, userId })),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 400 });
  }
}

/** DELETE /api/tasks/:id — удалить задачу */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.taskAssignment.deleteMany({ where: { taskId: params.id } });
      await tx.task.delete({ where: { id: params.id } });
    });
    return new Response(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 400 });
  }
}
