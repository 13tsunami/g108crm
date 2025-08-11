// app/api/debug/db/route.ts
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = { seq: number; name: string; file: string | null };

export async function GET() {
  const rows = (await prisma.$queryRawUnsafe(`PRAGMA database_list;`)) as Row[];
  // обычно основной файл — та строка, где name === 'main'
  return new Response(JSON.stringify({ list: rows }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
