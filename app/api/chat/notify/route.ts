import { NextRequest, NextResponse } from "next/server";
import { pushThreadUpdated } from "../_bus";

export async function POST(req: NextRequest) {
  const { toUserId } = await req.json().catch(() => ({}));
  if (toUserId) pushThreadUpdated([toUserId]);
  return NextResponse.json({ ok: true });
}
