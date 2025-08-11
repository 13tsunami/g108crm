// app/api/debug/health/route.ts
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function GET() {
  try {
    const pragma = (await (prisma as any).$queryRawUnsafe(`PRAGMA database_list;`)) as any[];
    const where = Array.isArray(pragma) ? pragma.map(r => ({ name: r?.name, file: r?.file })) : [];

    const count = await (prisma as any).user.count();
    const first = count ? (await (prisma as any).user.findFirst()) : null;

    return json({
      ok: true,
      dbFiles: where,         // здесь будет абсолютный путь к активной БД (строка с name: "main")
      usersCount: count,
      firstUserKeys: first ? Object.keys(first) : [],
      firstUserSample: first,
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message, stack: e?.stack }, { status: 500 });
  }
}
