import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { pushThreadUpdated } from "../../../_bus";
const prisma = new PrismaClient();

function getUserId(req: NextRequest) {
  const h = req.headers.get("x-user-id"); if (h) return h;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)uid=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

async function getReadPair(threadId: string, uid: string) {
  const t = await prisma.thread.findUnique({ where: { id: threadId } }) as any;
  if (!t) return { myReadAt: null, peerReadAt: null };
  const peerId = t.aId === uid ? t.bId : t.bId === uid ? t.aId : null;

  const my = await prisma.chatRead.findUnique({
    where: { threadId_userId: { threadId, userId: uid } },
  });
  const peer = peerId
    ? await prisma.chatRead.findUnique({
        where: { threadId_userId: { threadId, userId: peerId } },
      })
    : null;

  return {
    myReadAt: my?.lastReadAt ? my.lastReadAt.toISOString() : null,
    peerReadAt: peer?.lastReadAt ? peer.lastReadAt.toISOString() : null,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ myReadAt: null, peerReadAt: null });
  const res = await getReadPair(params.id, uid);
  return NextResponse.json(res);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  await prisma.chatRead.upsert({
    where: { threadId_userId: { threadId: params.id, userId: uid } },
    create: { threadId: params.id, userId: uid, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  // уведомим обоих — списки/бейджи обновятся
  const t = await prisma.thread.findUnique({ where: { id: params.id } }) as any;
  if (t?.aId && t?.bId) pushThreadUpdated([t.aId, t.bId]);

  const res = await getReadPair(params.id, uid);
  return NextResponse.json(res);
}
