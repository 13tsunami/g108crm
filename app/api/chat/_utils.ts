// app/api/chat/_utils.ts  — ОБНОВЛЕНО
import type { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";

export function pairKey(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `direct:${x}:${y}`;
}

export async function getMe(prisma: PrismaClient, req: NextRequest) {
  const id = req.headers.get("x-user-id")?.trim();
  const name = req.headers.get("x-user-name")?.trim();

  if (id) {
    const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
    if (u) return u;
  }
  if (name) {
    // Важно: если имён-дубликатов несколько — возьмём первый по id.
    const u = await prisma.user.findFirst({
      where: { name },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    if (u) return u;
  }
  return null;
}

export function parsePeer(title: string, meId: string): string | null {
  const m = /^direct:([^:]+):([^:]+)$/.exec(title);
  if (!m) return null;
  const [a, b] = [m[1], m[2]];
  if (a === meId) return b;
  if (b === meId) return a;
  return null;
}
