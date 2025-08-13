// app/api/admin/cleanup-ghosts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as any;
const prisma: PrismaClient = g.prisma ?? new PrismaClient();
if (!g.prisma) g.prisma = prisma;

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}
function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function resolveUserId(req: NextRequest, q: URLSearchParams, body: Record<string, unknown> | null) {
  // query: userId / id / user
  for (const key of ["userId", "id", "user"]) {
    const v = q.get(key);
    if (v && v.trim()) return v.trim();
  }
  // body.userId
  if (body && typeof body.userId === "string" && body.userId.trim()) return body.userId.trim();
  // header
  const hdr = req.headers.get("x-user-id");
  if (hdr && hdr.trim()) return hdr.trim();
  // self=1 -> cookie uid
  const self = (q.get("self") ?? "").toLowerCase();
  if (self === "1" || self === "true") {
    const { cookies } = await import("next/headers");
    const c = await cookies();
    const uid = c.get("uid")?.value;
    if (uid && uid.trim()) return uid.trim();
  }
  // из Referer
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      const m = u.pathname.match(/\/(teachers|users)\/([a-z0-9]+)$/i);
      if (m?.[2]) return m[2];
      const rid = u.searchParams.get("id");
      if (rid && rid.trim()) return rid.trim();
    } catch {}
  }
  return "";
}

async function findGhosts() {
  // критерий: нет username/email/phone И нет связей/следов активности
  const candidates = await prisma.user.findMany({
    where: { AND: [{ username: null }, { email: null }, { phone: null }] },
    select: { id: true },
    take: 50000,
  });

  const ghosts: string[] = [];
  for (const c of candidates) {
    const id = c.id;
    const [groups, msgs, reads, assigns, threadsA, threadsB, createdTasks] = await Promise.all([
      prisma.groupMember.count({ where: { userId: id } }),
      prisma.message.count({ where: { authorId: id } }),
      prisma.chatRead.count({ where: { userId: id } }),
      prisma.taskAssignee.count({ where: { userId: id } }),
      prisma.thread.count({ where: { aId: id } }),
      prisma.thread.count({ where: { bId: id } }),
      prisma.task.count({ where: { createdById: id } }).catch(() => 0),
    ]);

    if (
      groups === 0 &&
      msgs === 0 &&
      reads === 0 &&
      assigns === 0 &&
      threadsA === 0 &&
      threadsB === 0 &&
      createdTasks === 0
    ) {
      ghosts.push(id);
    }
  }
  return ghosts;
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams;
  const body = (await req.text().catch(() => "")) || "";
  let bodyJson: Record<string, unknown> | null = null;
  try { bodyJson = body ? JSON.parse(body) : null; } catch { bodyJson = null; }

  const purgeQ = (q.get("purge") ?? "").toLowerCase();
  const purge = purgeQ === "1" || purgeQ === "true" || (typeof bodyJson?.purge === "boolean" ? (bodyJson?.purge as boolean) : false);
  if (!purge) return bad("Specify purge=1 to delete", 400);

  const explicitUserId = await resolveUserId(req, q, bodyJson);

  if (explicitUserId) {
    const user = await prisma.user.findUnique({ where: { id: explicitUserId } });
    if (!user) return bad("User not found", 404);

    await prisma.$transaction(async (tx) => {
      // обнулим авторство (safety)
      await tx.message.updateMany({ where: { authorId: explicitUserId }, data: { authorId: null } });
      // удалим пользователя (каскады настроены в схеме)
      await tx.user.delete({ where: { id: explicitUserId } });
      // подчистим пустые треды
      await tx.thread.deleteMany({ where: { aId: null, bId: null, messages: { none: {} } } });
    });

    return ok({ ok: true, deleted: [explicitUserId], sweep: false });
  }

  // массовая чистка «призраков»
  const ghosts = await findGhosts();
  if (ghosts.length === 0) return ok({ ok: true, deleted: [], sweep: true, note: "No ghosts found" });

  await prisma.$transaction(async (tx) => {
    await tx.message.updateMany({ where: { authorId: { in: ghosts } }, data: { authorId: null } });
    await tx.user.deleteMany({ where: { id: { in: ghosts } } });
    await tx.thread.deleteMany({ where: { aId: null, bId: null, messages: { none: {} } } });
  });

  return ok({ ok: true, deleted: ghosts, sweep: true });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
    },
  });
}
