// app/api/subjects/route.ts
// В этом файле по ошибке обращались к prisma.role — из-за этого и ошибка 2339.
// Если у тебя нет модели Subject, вернём 501, чтобы сборка проходила.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "SUBJECTS_API_NOT_IMPLEMENTED" }, { status: 501 });
}
