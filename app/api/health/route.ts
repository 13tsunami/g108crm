// app/api/health/route.ts
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const n = await prisma.user.count();
    return Response.json({ ok: true, users: n });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "DB error" }, { status: 500 });
  }
}
