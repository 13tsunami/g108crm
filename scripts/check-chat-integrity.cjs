// scripts/check-chat-integrity.cjs
/* Запуск:
   1) taskkill /F /IM node.exe 2>$null
   2) node scripts/check-chat-integrity.cjs
*/
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    // 1) NULL-пары
    const nullPairs = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS n FROM "Thread" WHERE "aId" IS NULL OR "bId" IS NULL;`
    );
    const nNull = Number(nullPairs?.[0]?.n ?? 0);

    // 2) Дубликаты пар (учитываем только не-NULL)
    const dupRows = await prisma.$queryRawUnsafe(`
      SELECT aId, bId, COUNT(*) AS c
      FROM "Thread"
      WHERE aId IS NOT NULL AND bId IS NOT NULL
      GROUP BY aId, bId
      HAVING COUNT(*) > 1;
    `);

    // 3) Пустые title
    const emptyTitles = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS n FROM "Thread" WHERE title IS NULL OR title = '';`
    );
    const nEmptyTitle = Number(emptyTitles?.[0]?.n ?? 0);

    // 4) Проверка индекса уникальности (создадим, если нет)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "thread_pair_unique" ON "Thread"("aId","bId");`
    );

    console.log("=== Проверка чатов ===");
    console.log("Тредов с NULL aId/bId:", nNull);
    console.log("Пар с дубликатами:", dupRows.length);
    if (dupRows.length) {
      console.log("Примеры дублей (до 5):", dupRows.slice(0, 5));
    }
    console.log("Пустых title:", nEmptyTitle);
    console.log("✔ Индекс thread_pair_unique присутствует/создан.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
