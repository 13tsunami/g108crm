// scripts/chat-backfill.cjs
/* Запуск:
   1) taskkill /F /IM node.exe 2>$null
   2) node scripts/chat-backfill.cjs
*/
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** получить id тредов, где aId или bId = NULL (обход валидации Prisma) */
async function fetchThreadsWithNullPair() {
  const rows = await prisma.$queryRawUnsafe(`SELECT id FROM "Thread" WHERE "aId" IS NULL OR "bId" IS NULL;`);
  return rows.map(r => r.id);
}

/** проставить пару участников и last* или удалить пустые/односторонние */
async function backfillPairs(ids) {
  for (const tid of ids) {
    const msgs = await prisma.message.findMany({
      where: { threadId: tid },
      orderBy: { createdAt: "asc" },
      select: { authorId: true },
    });

    const uniq = [];
    for (const m of msgs) if (!uniq.includes(m.authorId)) uniq.push(m.authorId);

    if (uniq.length === 0) {
      // тред пуст — чистим всё связанное и удаляем
      await prisma.chatRead.deleteMany({ where: { threadId: tid } });
      await prisma.message.deleteMany({ where: { threadId: tid } });
      await prisma.thread.delete({ where: { id: tid } });
      console.log("Удалён пустой тред:", tid);
      continue;
    }

    if (uniq.length === 1) {
      // односторонний — тоже удаляем
      await prisma.chatRead.deleteMany({ where: { threadId: tid } });
      await prisma.message.deleteMany({ where: { threadId: tid } });
      await prisma.thread.delete({ where: { id: tid } });
      console.log("Удалён односторонний тред:", tid);
      continue;
    }

    let a = uniq[0], b = uniq[1];
    if (uniq.length > 2) { const lastTwo = uniq.slice(-2); a = lastTwo[0]; b = lastTwo[1]; }
    const [sa, sb] = [a, b].sort();

    await prisma.thread.update({ where: { id: tid }, data: { aId: sa, bId: sb } });

    const last = await prisma.message.findFirst({
      where: { threadId: tid },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, text: true },
    });

    await prisma.thread.update({
      where: { id: tid },
      data: {
        lastMessageAt: last ? last.createdAt : null,
        lastMessageText: last ? last.text : null,
      },
    });
  }
}

/** дедупликация: оставляем один тред на пару (aId,bId), переносим сообщения и read-метки */
async function dedupeThreads() {
  // пары с дублями
  const pairs = await prisma.$queryRawUnsafe(`
    SELECT aId, bId, COUNT(*) cnt
    FROM "Thread"
    WHERE aId IS NOT NULL AND bId IS NOT NULL
    GROUP BY aId, bId
    HAVING COUNT(*) > 1;
  `);

  for (const row of pairs) {
    const aId = row.aId, bId = row.bId;

    // собираем треды по паре с их "последним" временем
    const withLast = await prisma.$queryRawUnsafe(`
      SELECT t.id as id,
             COALESCE(MAX(m.createdAt), 0) AS ts
      FROM "Thread" t
      LEFT JOIN "Message" m ON m.threadId = t.id
      WHERE t.aId = ? AND t.bId = ?
      GROUP BY t.id
      ORDER BY ts DESC;
    `, aId, bId);

    if (!withLast.length) continue;

    const main = withLast[0].id;
    const dups = withLast.slice(1).map(x => x.id);

    for (const d of dups) {
      // переносим сообщения
      await prisma.message.updateMany({ where: { threadId: d }, data: { threadId: main } });

      // переносим/сливаем read-метки
      const reads = await prisma.chatRead.findMany({ where: { threadId: d } });
      for (const r of reads) {
        const cur = await prisma.chatRead.findUnique({
          where: { threadId_userId: { threadId: main, userId: r.userId } },
          select: { lastReadAt: true },
        });
        const newer = !cur || r.lastReadAt > cur.lastReadAt;
        await prisma.chatRead.upsert({
          where: { threadId_userId: { threadId: main, userId: r.userId } },
          create: { threadId: main, userId: r.userId, lastReadAt: r.lastReadAt },
          update: newer ? { lastReadAt: r.lastReadAt } : {},
        });
      }
      await prisma.chatRead.deleteMany({ where: { threadId: d } });

      // удаляем дубль-тред
      await prisma.thread.delete({ where: { id: d } });
      console.log(`Слит дубль ${d} → ${main} (${aId}__${bId})`);
    }

    // пересчитываем last* у главного
    const last = await prisma.message.findFirst({
      where: { threadId: main },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, text: true },
    });
    await prisma.thread.update({
      where: { id: main },
      data: {
        lastMessageAt: last ? last.createdAt : null,
        lastMessageText: last ? last.text : null,
      },
    });
  }
}

async function main() {
  // 1) добиваем ChatRead.id уже сделали патчем — отлично.
  // 2) заполняем пары там, где null
  const ids = await fetchThreadsWithNullPair();
  if (ids.length) {
    console.log("Тредов с NULL-парой:", ids.length);
    await backfillPairs(ids);
  } else {
    console.log("NULL-пар нет — пропускаю backfill пары.");
  }

  // 3) объединяем дубли по паре
  await dedupeThreads();

  console.log("Готово.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
