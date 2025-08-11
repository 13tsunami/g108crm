// scripts/patch-db.js
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  // Бэкап на всякий случай
  try {
    const src = path.join(process.cwd(), "prisma", "dev.db");
    const dstDir = path.join(process.cwd(), "prisma", "backups");
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    const dst = path.join(dstDir, `dev_${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
    if (fs.existsSync(src)) fs.copyFileSync(src, dst);
    console.log("✅ Backup:", dst);
  } catch (e) {
    console.warn("⚠️  Backup failed (продолжаем):", e.message);
  }

  // Какие колонки уже есть
  const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info('User');`);
  const existing = new Set(cols.map(c => c.name));

  const addIfMissing = async (name, sql) => {
    if (!existing.has(name)) {
      console.log("➕ add column:", name);
      await prisma.$executeRawUnsafe(sql);
    } else {
      console.log("✓ exists:", name);
    }
  };

  await addIfMissing("email",             `ALTER TABLE "User" ADD COLUMN "email" TEXT`);
  await addIfMissing("username",          `ALTER TABLE "User" ADD COLUMN "username" TEXT`);
  await addIfMissing("avatarUrl",         `ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT`);
  await addIfMissing("telegram",          `ALTER TABLE "User" ADD COLUMN "telegram" TEXT`);
  await addIfMissing("about",             `ALTER TABLE "User" ADD COLUMN "about" TEXT`);
  await addIfMissing("notifyEmail",       `ALTER TABLE "User" ADD COLUMN "notifyEmail" INTEGER DEFAULT 1`);
  await addIfMissing("notifyTelegram",    `ALTER TABLE "User" ADD COLUMN "notifyTelegram" INTEGER DEFAULT 0`);
  await addIfMissing("subjects",          `ALTER TABLE "User" ADD COLUMN "subjects" TEXT`);
  await addIfMissing("methodicalGroups",  `ALTER TABLE "User" ADD COLUMN "methodicalGroups" TEXT`);
  await addIfMissing("passwordHash",      `ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT`);

  // Индексы
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");`);

  // Значения по умолчанию для существующих строк
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "notifyEmail"    = COALESCE("notifyEmail", 1)`);
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "notifyTelegram" = COALESCE("notifyTelegram", 0)`);
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "subjects" = '[]' WHERE "subjects" IS NULL`);
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "methodicalGroups" = '[]' WHERE "methodicalGroups" IS NULL`);

  console.log("✅ Patch complete");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
