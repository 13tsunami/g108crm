import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function getUserId(req: NextRequest) {
  const h = req.headers.get("x-user-id"); if (h) return h;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)uid=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ count: 0 });

  const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `
    SELECT COUNT(*) AS c FROM (
      SELECT t.id,
             MAX(CASE WHEN m.createdAt > COALESCE(
                           (SELECT cs.clearedAt FROM "ChatState" cs WHERE cs.threadId = t.id AND cs.userId = ?), 0)
                      THEN m.createdAt END) AS lastMsg,
             COALESCE((SELECT r.lastReadAt FROM "ChatRead" r WHERE r.threadId = t.id AND r.userId = ?), 0) AS lastRead
      FROM "Thread" t
      LEFT JOIN "Message" m ON m.threadId = t.id
      WHERE (t.aId = ? OR t.bId = ?)
        AND NOT EXISTS (
          SELECT 1 FROM "ChatState" csx
          WHERE csx.threadId = t.id AND csx.userId = ? AND csx.hiddenAt IS NOT NULL
        )
      GROUP BY t.id
    ) s
    WHERE s.lastMsg IS NOT NULL AND s.lastMsg > s.lastRead;
    `,
    uid, uid, uid, uid, uid
  );

  return NextResponse.json({ count: Number(rows?.[0]?.c ?? 0) });
}
