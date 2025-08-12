// app/api/chat/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pushThreadUpdated } from "../_bus";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const ids: string[] = body.toUserIds ?? (body.toUserId ? [body.toUserId] : []);
  const threadId: string | undefined = body.threadId;

  for (const id of ids) pushThreadUpdated(id, threadId);
  return NextResponse.json({ ok: true });
}
