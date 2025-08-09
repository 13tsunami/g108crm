// app/api/roles/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const db = prisma as any;

export async function GET() {
  try {
    const roles = await db.role.findMany({
      select: { id: true, name: true, slug: true, power: true },
      orderBy: [{ power: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(roles);
  } catch (e) {
    console.error("GET /api/roles failed:", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
