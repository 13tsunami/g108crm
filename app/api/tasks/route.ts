// app/api/tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as { prisma?: PrismaClient };
const prisma = g.prisma ?? new PrismaClient();
if (!g.prisma) g.prisma = prisma;

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

async function getUserIdFromCookieOrBody(req: NextRequest) {
  const c = await cookies();
  let uid = c.get("uid")?.value;
  // fallback — из тела (если форма пошлёт явно)
  try {
    const b = await req.json();
    if (!uid && b && typeof b.createdById === "string") uid = b.createdById;
    // вернём тело обратно, чтобы не терять в POST
    (req as any)._body = b;
  } catch {
    /* no body */
  }
  return uid;
}

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        assignees: { include: { user: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    const shaped = tasks.map((t) => ({
      id: t.id,
      seq: t.seq ?? undefined,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate.toISOString(),
      hidden: t.hidden,
      priority: t.priority,
      createdBy: t.createdById ?? null,
      assignees: t.assignees.map(a => ({
        userId: a.userId,
        status: a.status,
        doneAt: a.doneAt?.toISOString() ?? null,
      })),
      assignedTo: t.assignees.map(a => ({ type: "user" as const, id: a.userId })),
    }));

    return NextResponse.json(shaped);
  } catch (e) {
    console.error("tasks GET error:", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // тело могло быть уже прочитано в getUserIdFromCookieOrBody
    const creatorId = await getUserIdFromCookieOrBody(req);
    const body = ((req as any)._body) ?? (await req.json().catch(() => null));
    if (!body || typeof body !== "object") return bad("Invalid JSON");

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description : "";
    const dueDateStr = typeof body.dueDate === "string" ? body.dueDate : null;
    const priorityRaw = typeof body.priority === "string" ? body.priority : "normal";
    const hidden = !!body.hidden;
    const assigneeUserIds: string[] = Array.isArray(body.assigneeUserIds)
      ? body.assigneeUserIds.filter((x: any) => typeof x === "string")
      : [];

    if (!title) return bad("title is required");
    if (!dueDateStr) return bad("dueDate is required (ISO)");
    const dueDate = new Date(dueDateStr);
    if (isNaN(+dueDate)) return bad("dueDate is invalid");

    const priority = priorityRaw === "high" ? "high" : "normal";

    if (assigneeUserIds.length > 0) {
      const existing = await prisma.user.findMany({
        where: { id: { in: assigneeUserIds } },
        select: { id: true },
      });
      const existingSet = new Set(existing.map((u) => u.id));
      const missing = assigneeUserIds.filter((id) => !existingSet.has(id));
      if (missing.length > 0) {
        return bad(`Unknown assignee ids: ${missing.join(", ")}`, 400);
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      // авто seq (пока без БД-ограничения)
      const last = await tx.task.findFirst({
        select: { seq: true },
        where: { seq: { not: null } },
        orderBy: { seq: "desc" },
      });
      const seq = (last?.seq ?? 0) + 1;

      const task = await tx.task.create({
        data: {
          seq,
          title,
          description,
          dueDate,
          hidden,
          priority,
          createdById: creatorId ?? null,
        },
      });

      const uniqueIds = Array.from(new Set(assigneeUserIds));
      if (uniqueIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: uniqueIds.map((userId) => ({ taskId: task.id, userId, status: "open" })),
        });
      }

      const full = await tx.task.findUnique({
        where: { id: task.id },
        include: { assignees: true },
      });

      return full!;
    });

    const response = {
      id: created.id,
      seq: created.seq ?? undefined,
      title: created.title,
      description: created.description,
      dueDate: created.dueDate.toISOString(),
      hidden: created.hidden,
      priority: created.priority,
      createdBy: created.createdById ?? null,
      assignees: created.assignees.map(a => ({
        userId: a.userId,
        status: a.status,
        doneAt: a.doneAt?.toISOString() ?? null,
      })),
      assignedTo: created.assignees.map(a => ({ type: "user" as const, id: a.userId })),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2003") return bad("One or more assigneeUserIds do not exist", 400);
    console.error("tasks POST error:", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
