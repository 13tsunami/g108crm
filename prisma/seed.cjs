// prisma/seed.cjs — чистый CommonJS, без next/*
// Запускается через: npx prisma db seed

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

// Ровно те пользователи и роли, что ты просил
const USERS = [
  { name: "Каминов Айткали Айбасович", role: "director" },
  { name: "Сенатор Вячеслав Александрович", role: "deputy_plus" },
  { name: "Фартушный Владислав Сергеевич", role: "deputy" },
  { name: "Носкова Дария Сергеевна", role: "teacher_plus" },
  { name: "Курашева Любовь Вадимовна", role: "teacher" },
  // Вы — “Заместитель +”; флаг рута считаем в rbac, в БД отдельного поля нет
  { name: "Евжик Иван Сергеевич", role: "deputy_plus" },
];

async function upsertByName(u, passwordHash) {
  // В схеме name не уникален → делаем "ручной upsert" (findFirst → update|create)
  const found = await prisma.user.findFirst({ where: { name: u.name } });
  if (found) {
    return prisma.user.update({
      where: { id: found.id },
      data: {
        role: u.role,
        passwordHash,
        // убедимся, что новые колонки существуют и не undefined
        email: found.email ?? null,
        phone: found.phone ?? null,
        classroom: found.classroom ?? null,
        avatarUrl: found.avatarUrl ?? null,
        telegram: found.telegram ?? null,
        about: found.about ?? null,
        notifyEmail: found.notifyEmail ?? true,
        notifyTelegram: found.notifyTelegram ?? false,
        subjects: found.subjects ?? "[]",
        methodicalGroups: found.methodicalGroups ?? "[]",
      },
    });
  }
  return prisma.user.create({
    data: {
      name: u.name,
      role: u.role,
      passwordHash,
      email: null,
      phone: null,
      classroom: null,
      avatarUrl: null,
      telegram: null,
      about: null,
      notifyEmail: true,
      notifyTelegram: false,
      subjects: "[]",
      methodicalGroups: "[]",
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("test1", 10);
  for (const u of USERS) {
    await upsertByName(u, passwordHash);
  }
  const count = await prisma.user.count();
  console.log(`✅ Seed ok. Users total: ${count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  });
