// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

function noStore() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
}

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    const token = await getToken({ req, secret, raw: false });
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore() });
    }

    const id =
      (token as any).uid ??
      (token as any).id ??
      (typeof token.sub === "string" ? token.sub : null);

    if (!id) {
      return NextResponse.json({ error: "no id in token" }, { status: 400, headers: noStore() });
    }

    const name =
      (token as any).name ??
      (token as any).user?.name ??
      null;

    const role =
      (token as any).role ??
      (token as any).user?.role ??
      null;

    return NextResponse.json(
      { id: String(id), name: name ?? null, role: role ?? null },
      { status: 200, headers: noStore() }
    );
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400, headers: noStore() });
  }
}
