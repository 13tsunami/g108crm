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

/** GET /api/tasks — список задач с назначенными пользователями */
export async function GET() {
  const rows = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignees: { include: { user: true } } },
  });

  const data = rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    priority: t.priority,
    assignees: t.assignees.map((a) => ({
      userId: a.userId,
      userName: a.user.name,
    })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return NextResponse.json(data);
}

/** POST /api/tasks — создать задачу + назначить исполнителей */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
    }

    const description = body.description ? String(body.description) : null;
    const dueDate = parseDate(body.dueDate);
    const priority = toPriority(body.priority);
    const assignees: string[] = Array.isArray(body.assignees) ? body.assignees : [];
    const uniqueAssignees = [...new Set(assignees.map(String).filter(Boolean))];

    const task = await prisma.task.create({
      data: {
        title,
        description,
        dueDate: dueDate ?? undefined,
        priority,
      },
    });

    if (uniqueAssignees.length) {
      await prisma.taskAssignment.createMany({
        data: uniqueAssignees.map((userId) => ({ taskId: task.id, userId })),
        // skipDuplicates: true // ← для SQLite тип never, поэтому не используем
      });
    }

    return NextResponse.json({ id: task.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 400 });
  }
}
