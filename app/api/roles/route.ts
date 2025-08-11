// app/api/roles/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // статический список ролей (как и в фронте)
  const roles = [
    { slug: "director",     name: "Директор",      power: 5 },
    { slug: "deputy_plus",  name: "Заместитель +", power: 4 },
    { slug: "deputy",       name: "Заместитель",   power: 3 },
    { slug: "teacher_plus", name: "Педагог +",     power: 2 },
    { slug: "teacher",      name: "Педагог",       power: 1 },
  ];
  return NextResponse.json(roles);
}
