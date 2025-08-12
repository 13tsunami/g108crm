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
  if (!uid) return NextResponse.json([]);

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT
      t.id,
      CASE WHEN t.aId = ? THEN t.bId ELSE t.aId END AS peerId,
      (SELECT name FROM "User" u WHERE u.id = CASE WHEN t.aId = ? THEN t.bId ELSE t.aId END) AS peerName,
      -- pulled clearedAt for current user (may be NULL)
      (SELECT cs.clearedAt FROM "ChatState" cs WHERE cs.threadId = t.id AND cs.userId = ? LIMIT 1) AS clearedAt,

      -- last visible text/time AFTER clearedAt
      (SELECT m2.text
         FROM "Message" m2
        WHERE m2.threadId = t.id AND m2.createdAt > COALESCE(
              (SELECT cs.clearedAt FROM "ChatState" cs WHERE cs.threadId = t.id AND cs.userId = ? LIMIT 1), 0)
        ORDER BY m2.createdAt DESC
        LIMIT 1) AS lastMessageText,

      (SELECT m2.createdAt
         FROM "Message" m2
        WHERE m2.threadId = t.id AND m2.createdAt > COALESCE(
              (SELECT cs.clearedAt FROM "ChatState" cs WHERE cs.threadId = t.id AND cs.userId = ? LIMIT 1), 0)
        ORDER BY m2.createdAt DESC
        LIMIT 1) AS lastMessageAt,

      -- unread AFTER both lastReadAt and clearedAt
      (SELECT COUNT(1)
         FROM "Message" m
        WHERE m.threadId = t.id
          AND m.authorId <> ?
          AND m.createdAt > COALESCE(
                (SELECT r2.lastReadAt FROM "ChatRead" r2 WHERE r2.threadId = t.id AND r2.userId = ?), 0)
          AND m.createdAt > COALESCE(
                (SELECT cs.clearedAt   FROM "ChatState" cs WHERE cs.threadId = t.id AND cs.userId = ?), 0)
      ) AS unreadCount

    FROM "Thread" t
    WHERE (t.aId = ? OR t.bId = ?)
      AND NOT EXISTS (
        SELECT 1 FROM "ChatState" csx
        WHERE csx.threadId = t.id AND csx.userId = ? AND csx.hiddenAt IS NOT NULL
      )
    ORDER BY (lastMessageAt IS NULL), lastMessageAt DESC, t.id DESC;
    `,
    uid, uid,        // peer
    uid, uid, uid,   // clearedAt + lastMessage filters
    uid, uid, uid,   // unread filters
    uid, uid,        // participation
    uid              // NOT EXISTS(hidden)
  );

  return NextResponse.json(
    rows.map(r => ({
      id: r.id,
      peerId: r.peerId,
      peerName: r.peerName ?? null,
      lastMessageText: r.lastMessageText ?? null,
      lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt).toISOString() : null,
      unreadCount: Number(r.unreadCount || 0),
    }))
  );
}
