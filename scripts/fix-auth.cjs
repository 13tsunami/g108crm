// scripts/fix-auth.cjs
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

// маппинг ФИО → username
const MAP = {
  "Каминов Айткали Айбасович": "kaminov",
  "Сенатор Вячеслав Александрович": "senator",
  "Фартушный Владислав Сергеевич": "fartushny",
  "Носкова Дария Сергеевна": "noskova",
  "Курашева Любовь Вадимовна": "kurasheva",
  "Евжик Иван Сергеевич": "evzhik",
};

async function main() {
  const passwordHash = await bcrypt.hash("test1", 10);

  for (const [fio, username] of Object.entries(MAP)) {
    const user = await prisma.user.findFirst({ where: { name: fio } });
    if (!user) {
      console.log("⚠️  not found:", fio);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username,
        passwordHash,
        // роль оставляем как есть; если пусто — расставим по ФИО
        role: user.role || (
          fio.includes("Каминов") ? "director" :
          fio.includes("Сенатор") ? "deputy_plus" :
          fio.includes("Фартушный") ? "deputy" :
          fio.includes("Носкова") ? "teacher_plus" :
          fio.includes("Курашева") ? "teacher" :
          fio.includes("Евжик") ? "deputy_plus" : null
        ),
        // страховка для новых колонок
        email: user.email ?? null,
        subjects: user.subjects ?? "[]",
        methodicalGroups: user.methodicalGroups ?? "[]",
        notifyEmail: user.notifyEmail ?? true,
        notifyTelegram: user.notifyTelegram ?? false,
      },
    });
    console.log(`✅ ${fio} → ${username}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
