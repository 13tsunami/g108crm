// prisma/seed.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const db = prisma as any;

const ROLES = [
  { slug: "director",     name: "Директор",      power: 5 },
  { slug: "deputy_plus",  name: "Заместитель +", power: 4 },
  { slug: "deputy",       name: "Заместитель",   power: 3 },
  { slug: "teacher_plus", name: "Педагог +",     power: 2 },
  { slug: "teacher",      name: "Педагог",       power: 1 },
] as const;

async function main() {
  for (const r of ROLES) {
    await db.role.upsert({
      where: { slug: r.slug },
      create: r,
      update: { name: r.name, power: r.power },
    });
  }

  const map = new Map<string, string>();
  const all = await db.role.findMany({ select: { id: true, name: true } });
  all.forEach((r: any) => map.set(r.name, r.id));

  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  for (const u of users) {
    const legacy = (u.role || "").trim();
    if (!legacy) continue;
    const roleId = map.get(legacy);
    if (!roleId) continue;

    const exists = await db.userRole.findUnique({
      where: { userId_roleId: { userId: u.id, roleId } },
    }).catch(() => null);
    if (!exists) {
      await db.userRole.create({ data: { userId: u.id, roleId } });
    }
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
