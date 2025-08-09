// prisma/bootstrap.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, User } from "@prisma/client";
const prisma = new PrismaClient();
const db = prisma as any;

async function main() {
  const ADMIN_NAME = "Евжик Иван Сергеевич";
  const ADMIN_PHONE = "+79990000000";
  const ADMIN_ROLE_SLUG = "deputy_plus";

  // 1) ищем по телефону или имени
  let admin: User | null = await prisma.user.findFirst({
    where: { OR: [{ phone: ADMIN_PHONE }, { name: ADMIN_NAME }] },
  });

  // 2) создаём при отсутствии, либо синхронизируем ФИО/телефон
  if (!admin) {
    admin = (await db.user.create({
      data: { name: ADMIN_NAME, phone: ADMIN_PHONE, avatarUrl: "/avatar.png" } as any,
    })) as User;
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { name: ADMIN_NAME, phone: ADMIN_PHONE },
    });
  }

  // Явная гарантия для TS: дальше admin точно есть
  if (!admin) throw new Error("Bootstrap: не удалось создать/получить пользователя.");
  const adminId = admin.id;

  // 3) выдаём роль «Заместитель +»
  const role = await db.role.findUnique({ where: { slug: ADMIN_ROLE_SLUG } });
  if (!role) throw new Error("Роль deputy_plus не найдена. Сначала запусти `npm run prisma:seed`.");

  await db.userRole.upsert({
    where: { userId_roleId: { userId: adminId, roleId: role.id } },
    update: {},
    create: { userId: adminId, roleId: role.id },
  });

  console.log("✅ Bootstrap complete.");
  console.log("ROOT_USER_ID =", adminId);
  console.log(`Добавь в .env: ROOT_USER_IDS="${adminId}"`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
